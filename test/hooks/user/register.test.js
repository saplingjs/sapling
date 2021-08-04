import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import Request from '../../../lib/Request.js';
import Response from '../../../lib/Response.js';
import SaplingError from '../../../lib/SaplingError.js';
import Storage from '../../../lib/Storage.js';
import User from '../../../lib/User.js';

import register from '../../../hooks/sapling/user/register.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'untitled'
	}, (await import('../../_utils/app.js')).default());

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


test.serial('registers an account', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content[0]));
	t.true('_id' in response.content[0]);
	t.true('email' in response.content[0]);
	t.true('role' in response.content[0]);
	t.is(response.content[0].role, 'member');

	t.false('password' in response.content[0]);
	t.false('_salt' in response.content[0]);

	const user = t.context.app.storage.db.memory.users[0];

	t.true('password' in user);
	t.true('_salt' in user);
	t.is(response.content[0]._id, user._id);
});

test.serial('registers an account with a defined role', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';
	t.context.request.body.role = 'admin';

	t.context.request.session.user = { role: 'admin' };

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content[0]));
	t.true('_id' in response.content[0]);
	t.true('email' in response.content[0]);
	t.true('role' in response.content[0]);
	t.is(response.content[0].role, 'admin');

	t.false('password' in response.content[0]);
	t.false('_salt' in response.content[0]);

	const user = t.context.app.storage.db.memory.users[0];

	t.true('password' in user);
	t.true('_salt' in user);
	t.is(response.content[0]._id, user._id);
});

test.serial('responds with an error when defined role exceeds session role', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';
	t.context.request.body.role = 'admin';

	t.context.request.session.user = { role: 'member' };

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].message, 'Do not have permission to create the role `admin`.');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('responds with an error when defining a role when not logged in', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';
	t.context.request.body.role = 'admin';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].message, 'Do not have permission to create the role `admin`.');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('responds with an error when no email is provided', async t => {
	t.context.request.body.password = 'password';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'email');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('responds with an error when insufficient email is provided', async t => {
	t.context.request.body.email = 'john@exam';
	t.context.request.body.password = 'password';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'email');
	t.is(response.error.json.errors[0].meta.rule, 'email');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('responds with an error when no password is provided', async t => {
	t.context.request.body.email = 'john@example.com';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('responds with an error when insufficient password is provided', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = '1';

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'minlen');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('redirects when specified', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await register(t.context.app, t.context.request, t.context.response);
});

test.serial('does not redirect with failed registration', async t => {
	t.context.request.body.email = 'john@example.com';

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = () => {
		t.fail('Should not redirect');
	};

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	t.is(t.context.app.storage.db.memory.users.length, 0);
});

test.serial('does not save when custom field does not validate', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';
	t.context.request.body.username = 'ausernamethatswaytoolong';

	t.context.app.storage.schema.users.username = {
		type: 'string',
		required: true,
		maxlen: 10
	};

	const response = await register(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'username');
	t.is(response.error.json.errors[0].meta.rule, 'maxlen');
	t.is(t.context.app.storage.db.memory.users.length, 0);
});
