import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import Request from '../../lib/Request.js';
import Storage from '../../lib/Storage.js';

import User from '../../lib/User.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.defaults({
		storage: new Storage({}, {
			name: 'test',
			schema: {
				posts: {
					one: {
						type: 'string'
					},
					two: {
						type: 'string',
						access: 'member'
					},
					three: {
						type: 'string',
						access: 'admin'
					},
					four: {
						type: 'string',
						access: {
							r: 'member',
							w: 'owner'
						}
					},
					five: {
						type: 'string',
						access: {
							r: 'admin',
							w: 'owner'
						}
					},
					six: {
						type: 'string',
						access: 'anyone'
					},
					seven: {
						type: 'string',
						access: 'owner'
					},
					eight: {
						type: 'string',
						access: {
							r: 'owner',
							w: 'admin'
						}
					}
				}
			},
			config: { db: { driver: 'Memory' } },
			dir: __dirname
		}),
		routeStack: {
			get: [
				'/faq',
				'/login',
				'/posts',
				'/edit',
				'/admin',
				'/contact'
			]
		},
		permissions: {
			'get /faq': { role: 'anyone' },
			'get /login': { role: 'stranger' },
			'get /posts': { role: 'member' },
			'get /edit': { role: ['member', 'admin'] },
			'get /admin': { role: 'admin' }
		}
	}, (await import('../_utils/app.js')).default());
	await t.context.app.storage.importDriver();

	t.context.response = (await import('../_utils/response.js')).default();

	t.context.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);
});


/* isUserAllowed */

test('checks anonymous is not allowed for member level', t => {
	t.false(t.context.user.isUserAllowed('member', null));
});

test('checks member is allowed for member level', t => {
	t.true(t.context.user.isUserAllowed('member', { role: 'member' }));
});

test('checks admin is allowed for member level', t => {
	t.true(t.context.user.isUserAllowed('member', { role: 'admin' }));
});

test('checks anonymous is not allowed for admin level', t => {
	t.false(t.context.user.isUserAllowed('admin', null));
});

test('checks member is not allowed for admin level', t => {
	t.false(t.context.user.isUserAllowed('admin', { role: 'member' }));
});

test('checks admin is allowed for admin level', t => {
	t.true(t.context.user.isUserAllowed('admin', { role: 'admin' }));
});

test('checks stranger is allowed for stranger level', t => {
	t.true(t.context.user.isUserAllowed('stranger', null));
});

test('checks member is not allowed for stranger level', t => {
	t.false(t.context.user.isUserAllowed('stranger', { role: 'member' }));
});

test('checks admin is not allowed for stranger level', t => {
	t.false(t.context.user.isUserAllowed('stranger', { role: 'admin' }));
});

test('checks anonymous is allowed for anyone level', t => {
	t.true(t.context.user.isUserAllowed('anyone', null));
});

test('checks member is allowed for anyone level', t => {
	t.true(t.context.user.isUserAllowed('anyone', { role: 'member' }));
});

test('checks admin is allowed for anyone level', t => {
	t.true(t.context.user.isUserAllowed('anyone', { role: 'admin' }));
});

test('checks member is allowed for an array of levels', t => {
	t.true(t.context.user.isUserAllowed(['member', 'admin'], { role: 'member' }));
});

test('checks member is not allowed for an array of levels', t => {
	t.false(t.context.user.isUserAllowed(['admin'], { role: 'member' }));
});


/* isRoleAllowed */

test('checks admin is allowed for all', t => {
	t.true(t.context.user.isRoleAllowed.call(t.context, 'admin', 'admin'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'admin', 'member'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'admin', ['admin', 'member']));
});

test('checks member is allowed for member', t => {
	t.false(t.context.user.isRoleAllowed.call(t.context, 'member', 'admin'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'member', 'member'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'member', ['admin', 'member']));
});

test('checks anyone is allowed for anyone', t => {
	t.true(t.context.user.isRoleAllowed.call(t.context, 'member', 'anyone'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'admin', 'anyone'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'member', ['anyone']));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'anonymous', 'anyone'));
});

test('checks unknown is not allowed for member', t => {
	t.false(t.context.user.isRoleAllowed.call(t.context, 'foobar', 'member'));
	t.false(t.context.user.isRoleAllowed.call(t.context, 'quux', ['admin', 'member']));
});

test('checks custom is allowed for custom', t => {
	t.context.app.storage.schema.users.role.values = ['admin', 'moderator', 'member'];
	t.true(t.context.user.isRoleAllowed.call(t.context, 'moderator', 'member'));
	t.false(t.context.user.isRoleAllowed.call(t.context, 'moderator', 'admin'));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'moderator', ['moderator', 'member']));
	t.true(t.context.user.isRoleAllowed.call(t.context, 'moderator', ['moderator', 'admin']));
	t.false(t.context.user.isRoleAllowed.call(t.context, 'moderator', ['admin']));
});


/* isUserAuthenticatedForRoute */

test('allows a user that is logged in for a protected route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'member' ]
		},
		session: {
			user: {
				role: 'member'
			}
		}
	}, t.context.response));
});

test('denies a user that is not logged in for a protected route', t => {
	t.false(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'member' ]
		},
		session: {}
	}, t.context.response));
});

test('allows a user that is logged in for a public route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'anyone' ]
		},
		session: {
			user: {
				role: 'member'
			}
		}
	}, t.context.response));
});

test('allows a user that is not logged in for a public route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'anyone' ]
		},
		session: {}
	}, t.context.response));
});

test('denies a user that is logged in for a stranger route', t => {
	t.false(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'stranger' ]
		},
		session: {
			user: {
				role: 'member'
			}
		}
	}, t.context.response));
});

test('allows a user that is not logged in for a stranger route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: {
			role: [ 'stranger' ]
		},
		session: {}
	}, t.context.response));
});

test('allows a user that is not logged in for an undefined route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: null,
		session: {}
	}, t.context.response));
});

test('allows a user that is logged in for an undefined route', t => {
	t.true(t.context.user.isUserAuthenticatedForRoute({
		permission: null,
		session: {
			user: {
				role: 'member'
			}
		}
	}, t.context.response));
});


/* getRolesForRoute */

test('returns correct role for routes', t => {
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/posts'), ['member']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/posts/'), ['member']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/Posts'), ['member']);

	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/faq'), ['anyone']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/login'), ['stranger']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/edit'), ['member', 'admin']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/admin'), ['admin']);
});

test('returns correct role for route with no permission set', t => {
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/contact'), ['anyone']);
});

test('returns correct role for undefined route', t => {
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'get', '/blog'), ['anyone']);
	t.deepEqual(t.context.user.getRolesForRoute.call(t.context, 'post', '/data/blog'), ['anyone']);
});


/* getRole */

test('returns the correct role from session', t => {
	t.is(t.context.user.getRole({
		session: {
			user: {
				role: 'member'
			}
		}
	}), 'member');
});

test('returns null for empty session', t => {
	t.is(t.context.user.getRole({
		session: {}
	}), null);
});

test('returns null from no session', t => {
	t.is(t.context.user.getRole({}), null);
});


/* disallowedFields */

test('returns the disallowed fields from rules for a stranger', t => {
	t.deepEqual(
		t.context.user.disallowedFields('stranger', t.context.app.storage.schema.posts),
		['two', 'three', 'four', 'five']
	);
});

test('returns the disallowed fields from rules for a member', t => {
	t.deepEqual(
		t.context.user.disallowedFields('member', t.context.app.storage.schema.posts),
		['three', 'five']
	);
});

test('returns the disallowed fields from rules for an admin', t => {
	t.deepEqual(
		t.context.user.disallowedFields('admin', t.context.app.storage.schema.posts),
		[]
	);
});


/* ownerFields */

test('returns the owner fields from rules', t => {
	t.deepEqual(
		t.context.user.ownerFields(t.context.app.storage.schema.posts),
		['seven', 'eight']
	);
});
