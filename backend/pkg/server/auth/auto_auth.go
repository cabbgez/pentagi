package auth

import (
	"errors"
	"fmt"
	"slices"
	"sync"
	"time"

	"pentagi/pkg/server/models"
	"pentagi/pkg/server/rdb"
	"pentagi/pkg/server/response"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"
)

const (
	// autoAuthSessionTTL is how far into the future the synthetic session claims
	// to be valid. It only feeds the expires_at the frontend checks, and every
	// request re-stamps it, so a bypassed deployment never looks expired.
	autoAuthSessionTTL = 24 * time.Hour

	// autoAuthAdminRoleID is the id of the seeded "Admin" role. It is used only as
	// a fallback when the configured bypass user cannot be resolved.
	autoAuthAdminRoleID uint64 = 1
)

// AutoAuthMiddleware authorizes every request as a fixed, real user so the
// application can be used without a login. It is wired in only when
// DISABLE_AUTH is enabled; it exists purely as an operator convenience and
// grants whichever privileges the resolved user's role carries.
type AutoAuthMiddleware struct {
	db         *gorm.DB
	userCache  *UserCache
	bypassUser string

	mu     sync.Mutex
	cached *autoAuthUser
}

// autoAuthUser is the resolved identity requests are stamped with. The hash and
// generation are refreshed from the cache on every call so that a password
// change or a session revoke is picked up without restarting the process.
type autoAuthUser struct {
	id         uint64
	hash       string
	name       string
	roleID     uint64
	generation uint64
	privileges []string
}

func NewAutoAuthMiddleware(db *gorm.DB, userCache *UserCache, bypassUser string) *AutoAuthMiddleware {
	return &AutoAuthMiddleware{
		db:         db,
		userCache:  userCache,
		bypassUser: bypassUser,
	}
}

// Handle is a drop-in replacement for AuthUserRequired / AuthTokenRequired /
// TryAuth. It performs no credential validation at all: instead it stamps the
// request with the bypass user's claims and lets it through, so downstream
// guards (PrivilegesRequired), the GraphQL layer and per-user data scoping all
// behave exactly as they would for a normally authenticated user.
func (p *AutoAuthMiddleware) Handle(c *gin.Context) {
	if c.IsAborted() {
		return
	}

	user, err := p.resolve()
	if err != nil {
		logrus.WithError(err).Error("auto-auth: failed to resolve the bypass user")
		response.Error(c, response.ErrAuthUnavailable, err)
		c.Abort()
		return
	}

	now := time.Now().Unix()
	exp := now + int64(autoAuthSessionTTL/time.Second)

	uuid, _ := rdb.MakeUuidStrFromHash(user.hash)

	c.Set("uid", user.id)
	c.Set("uhash", user.hash)
	c.Set("rid", user.roleID)
	c.Set("tid", models.UserTypeLocal.String())
	c.Set("uname", user.name)
	c.Set("prm", user.privileges)
	c.Set("sgn", user.generation)
	c.Set("gtm", now)
	c.Set("exp", exp)
	c.Set("uuid", uuid)

	if slices.Contains(user.privileges, PrivilegeAutomation) {
		c.Set("cpt", "automation")
	}

	// Mirror the claims into the cookie session. Handlers that read the session
	// directly (localUserRequired, which guards password/email changes) and
	// repeated /info round-trips then keep working without going through login.
	p.syncSession(c, user, now, exp)

	c.Next()
}

func (p *AutoAuthMiddleware) resolve() (*autoAuthUser, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.cached != nil {
		if info, err := p.userCache.GetUser(p.cached.id); err == nil && info.Status == models.UserStatusActive {
			p.cached.hash = info.Hash
			p.cached.generation = info.Generation
			return p.cached, nil
		}
	}

	user, err := p.findBypassUser()
	if err != nil {
		return nil, err
	}

	var privileges []string
	if err := p.db.Table("privileges").
		Where("role_id = ?", user.RoleID).
		Pluck("name", &privileges).Error; err != nil {
		return nil, fmt.Errorf("loading privileges for role %d: %w", user.RoleID, err)
	}
	if len(privileges) == 0 {
		return nil, fmt.Errorf("role %d has no privileges", user.RoleID)
	}

	p.cached = &autoAuthUser{
		id:         user.ID,
		hash:       user.Hash,
		name:       user.Name,
		roleID:     user.RoleID,
		generation: user.SessionGeneration,
		privileges: privileges,
	}

	logrus.WithFields(logrus.Fields{
		"uid":  user.ID,
		"mail": user.Mail,
		"rid":  user.RoleID,
	}).Warn("auto-auth: authentication is disabled, authorizing requests as this user")

	return p.cached, nil
}

func (p *AutoAuthMiddleware) findBypassUser() (models.User, error) {
	var user models.User

	if p.bypassUser != "" {
		err := p.db.Where("mail = ? AND status = ?", p.bypassUser, models.UserStatusActive.String()).
			First(&user).Error
		if err == nil {
			return user, nil
		}
		if !gorm.IsRecordNotFoundError(err) {
			return user, fmt.Errorf("looking up bypass user %q: %w", p.bypassUser, err)
		}
		logrus.WithField("mail", p.bypassUser).
			Warn("auto-auth: bypass user not found, falling back to an administrator")
	}

	err := p.db.Where("status = ? AND role_id = ?", models.UserStatusActive.String(), autoAuthAdminRoleID).
		Order("id").First(&user).Error
	if err == nil {
		return user, nil
	}
	if !gorm.IsRecordNotFoundError(err) {
		return user, fmt.Errorf("looking up an administrator: %w", err)
	}

	err = p.db.Where("status = ?", models.UserStatusActive.String()).Order("id").First(&user).Error
	if err == nil {
		return user, nil
	}
	if gorm.IsRecordNotFoundError(err) {
		return user, errors.New("no active user is available for auto-auth")
	}

	return user, fmt.Errorf("looking up an active user: %w", err)
}

func (p *AutoAuthMiddleware) syncSession(c *gin.Context, user *autoAuthUser, now, exp int64) {
	session := sessions.Default(c)

	if uid, ok := session.Get("uid").(uint64); ok && uid == user.id {
		if sgn, ok := session.Get("sgn").(uint64); ok && sgn == user.generation {
			return
		}
	}

	session.Set("uid", user.id)
	session.Set("uhash", user.hash)
	session.Set("rid", user.roleID)
	session.Set("prm", user.privileges)
	session.Set("exp", exp)
	session.Set("gtm", now)
	session.Set("tid", models.UserTypeLocal.String())
	session.Set("uname", user.name)
	session.Set("sgn", user.generation)

	if err := session.Save(); err != nil {
		logrus.WithError(err).Warn("auto-auth: failed to persist the bypass session cookie")
	}
}
