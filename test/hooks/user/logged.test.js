const test = require('ava');
const _ = require('underscore');

const Response = require('../../../lib/Response');
const Storage = require('../../../lib/Storage');
const User = require('../../../lib/User');

const logged = require('../../../hooks/sapling/user/logged');


test.beforeEach(t => {
	t.context.app = require('../../_utils/app')();

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});

	t.context.app.user = new User(t.context.app);

	t.context.request = require('../../_utils/request')();
	t.context.response = require('../../_utils/response')();
});


test.serial('returns user object for session', async t => {
	const user = await t.context.app.storage.db.write('users', { email: 'john@example.com', role: 'member', password: 'hunter12', _salt: 'abc123' });
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	const response = await logged(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('_id' in response.content);
	t.true('email' in response.content);
	t.true('role' in response.content);

	t.false('password' in response.content);
	t.false('_salt' in response.content);
});

test.serial('returns empty for no session', async t => {
	const response = await logged(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.deepEqual(response.content, {});
});
