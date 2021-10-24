import test from 'ava';
import _ from 'underscore';

import Request from '../../../lib/Request.js';
import Response from '../../../lib/Response.js';
import SaplingError from '../../../lib/SaplingError.js';
import Storage from '../../../lib/Storage.js';
import User from '../../../lib/User.js';

import login from '../../../hooks/sapling/user/login.js';


const createUser = async t => {
	await t.context.app.storage.db.write('users', {
		email: 'john@example.com',
		username: 'john',
		password: 'yOw6Npt/UQaeq/eFxd3JVp/XPwO3PvFBEu48pe1X5SfMnThjVhv1+b+ENj7H3oCcQU/8TrZvxdYfUR9JEtzrp32/l0ctGGaximt4St+BGne6TzA+rFe4qR0dV1PTfHO47NFwly2PQYbzPGfuMjBI2rKHXfIOsz497HtQLyXjdus=',
		_salt: '4pLu1G6DwMeBS9bXN4QuoNu44m4uPt5PBzoZKXwzAbHlKA/kbl9lnn71IHyASW4QUEdq63qX2O7oObLRnv/6ddNH3dunoQPJZuDV/3FTjLC8bwzEG3AtDhcriXr8ANIlvQ0c6IXxarQ2WdbeDVi3FdkRGMtLVTjPx7Yobo/FCqc=',
		role: 'member'
	});
};


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'untitled'
	}, (await import('../../_utils/app.js')).default());

	t.context.app.user = new User(t.context.app);
	t.context.app.request = new Request(t.context.app);

	t.context.app.name = 'test';
	t.context.app.storage = new Storage(t.context.app);
	await t.context.app.storage.importDriver();

	t.context.request = (await import('../../_utils/request.js')).default();
	t.context.response = (await import('../../_utils/response.js')).default();
});


test.serial('creates session with default identifiable', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('_id' in response.content);
	t.true('email' in response.content);
	t.true('username' in response.content);
	t.true('role' in response.content);

	t.false('password' in response.content);
	t.false('_salt' in response.content);

	t.true(_.isObject(t.context.request.session.user));
	t.true('_id' in t.context.request.session.user);
	t.true('email' in t.context.request.session.user);
	t.true('username' in t.context.request.session.user);
	t.true('role' in t.context.request.session.user);

	t.false('password' in t.context.request.session.user);
	t.false('_salt' in t.context.request.session.user);
});

test.serial('creates session with custom identifiable', async t => {
	t.context.request.body.username = 'john';
	t.context.request.body.password = 'password';

	t.context.app.storage.schema.users.username = {
		type: 'string',
		required: true,
		identifiable: true
	};

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('_id' in response.content);
	t.true('email' in response.content);
	t.true('username' in response.content);
	t.true('role' in response.content);

	t.false('password' in response.content);
	t.false('_salt' in response.content);

	t.true(_.isObject(t.context.request.session.user));
	t.true('_id' in t.context.request.session.user);
	t.true('email' in t.context.request.session.user);
	t.true('username' in t.context.request.session.user);
	t.true('role' in t.context.request.session.user);

	t.false('password' in t.context.request.session.user);
	t.false('_salt' in t.context.request.session.user);
});

test.serial('creates session with non-specific default identifiable', async t => {
	t.context.request.body._identifiable = 'john@example.com';
	t.context.request.body.password = 'password';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('_id' in response.content);
	t.true('email' in response.content);
	t.true('username' in response.content);
	t.true('role' in response.content);

	t.false('password' in response.content);
	t.false('_salt' in response.content);

	t.true(_.isObject(t.context.request.session.user));
	t.true('_id' in t.context.request.session.user);
	t.true('email' in t.context.request.session.user);
	t.true('username' in t.context.request.session.user);
	t.true('role' in t.context.request.session.user);

	t.false('password' in t.context.request.session.user);
	t.false('_salt' in t.context.request.session.user);
});

test.serial('creates session with non-specific custom identifiable', async t => {
	t.context.request.body._identifiable = 'john';
	t.context.request.body.password = 'password';

	t.context.app.storage.schema.users.username = {
		type: 'string',
		required: true,
		identifiable: true
	};

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('_id' in response.content);
	t.true('email' in response.content);
	t.true('username' in response.content);
	t.true('role' in response.content);

	t.false('password' in response.content);
	t.false('_salt' in response.content);

	t.true(_.isObject(t.context.request.session.user));
	t.true('_id' in t.context.request.session.user);
	t.true('email' in t.context.request.session.user);
	t.true('username' in t.context.request.session.user);
	t.true('role' in t.context.request.session.user);

	t.false('password' in t.context.request.session.user);
	t.false('_salt' in t.context.request.session.user);
});

test.serial('responds with an error when identifiable is missing', async t => {
	t.context.request.body.password = 'password';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'identifiable');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	t.false(_.isObject(t.context.request.session.user));
});

test.serial('responds with an error when password is missing', async t => {
	t.context.request.body.email = 'john@example.com';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	t.false(_.isObject(t.context.request.session.user));
});

test.serial('responds with an error when logging in with unknown user', async t => {
	t.context.request.body.email = 'mariah@example.com';
	t.context.request.body.password = 'password';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.type, 'login');
	t.is(response.error.json.errors[0].meta.error, 'invalid');

	t.false(_.isObject(t.context.request.session.user));
});

test.serial('responds with an error when logging in with incorrect password', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'hunter12';

	await createUser(t);

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.type, 'login');
	t.is(response.error.json.errors[0].meta.error, 'invalid');

	t.false(_.isObject(t.context.request.session.user));
});

test.serial('redirects when specified', async t => {
	t.context.request.body.email = 'john@example.com';
	t.context.request.body.password = 'password';

	t.context.request.query.redirect = '/app';

	await createUser(t);

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await login(t.context.app, t.context.request, t.context.response);
});

test.serial('does not redirect with failed login', async t => {
	t.context.request.body.email = 'john@example.com';

	t.context.request.query.redirect = '/app';

	await createUser(t);

	t.context.response.redirect = () => {
		t.fail('Should not redirect');
	};

	const response = await login(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);
});
