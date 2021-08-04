import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import Request from '../../../lib/Request.js';
import Response from '../../../lib/Response.js';
import Storage from '../../../lib/Storage.js';
import User from '../../../lib/User.js';

import logged from '../../../hooks/sapling/user/logged.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = (await import('../../_utils/app.js')).default();

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});
	await t.context.app.storage.importDriver();

	t.context.request = (await import('../../_utils/request.js')).default();
	t.context.response = (await import('../../_utils/response.js')).default();
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
