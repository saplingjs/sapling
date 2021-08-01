import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import Hash from '../../../lib/Hash.js';
import Response from '../../../lib/Response.js';
import SaplingError from '../../../lib/SaplingError.js';
import Storage from '../../../lib/Storage.js';
import User from '../../../lib/User.js';

import update from '../../../hooks/sapling/user/update.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


const createUser = async t => {
	return await t.context.app.storage.db.write('users', {
		email: 'john@example.com',
		username: 'john',
		password: 'yOw6Npt/UQaeq/eFxd3JVp/XPwO3PvFBEu48pe1X5SfMnThjVhv1+b+ENj7H3oCcQU/8TrZvxdYfUR9JEtzrp32/l0ctGGaximt4St+BGne6TzA+rFe4qR0dV1PTfHO47NFwly2PQYbzPGfuMjBI2rKHXfIOsz497HtQLyXjdus=',
		_salt: '4pLu1G6DwMeBS9bXN4QuoNu44m4uPt5PBzoZKXwzAbHlKA/kbl9lnn71IHyASW4QUEdq63qX2O7oObLRnv/6ddNH3dunoQPJZuDV/3FTjLC8bwzEG3AtDhcriXr8ANIlvQ0c6IXxarQ2WdbeDVi3FdkRGMtLVTjPx7Yobo/FCqc=',
		role: 'member',
		firstname: 'John',
		lastname: 'Public'
	});
};


test.beforeEach(async t => {
	t.context.app = _.extend({
		name: 'untitled'
	}, (await import('../../_utils/app.js')).default());

	t.context.app.storage = new Storage(t.context.app, {
		name: 'test',
		schema: {},
		config: { db: { driver: 'Memory' } },
		dir: __dirname
	});
	await t.context.app.storage.importDriver();

	t.context.app.user = new User(t.context.app);

	t.context.request = (await import('../../_utils/request.js')).default();
	t.context.response = (await import('../../_utils/response.js')).default();
});


test('updates the logged-in user', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.lastname = 'Private';
	t.context.request.body.password = 'password';

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content[0]));
	t.is(response.content[0].lastname, 'Private');

	t.false('password' in response.content[0]);
	t.false('_salt' in response.content[0]);

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].lastname, 'Private');
});

test('updates the password', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.new_password = 'hunter12';
	t.context.request.body.password = 'password';

	const oldSalt = user._salt;

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content[0]));

	t.false('new_password' in response.content[0]);
	t.false('password' in response.content[0]);
	t.false('_salt' in response.content[0]);

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, await new Hash().hash('hunter12', updatedUser[0]._salt));
	t.not(updatedUser[0]._salt, oldSalt);

	t.false('new_password' in updatedUser[0]);
});

test('responds with an error if not logged in', async t => {
	const user = await createUser(t);

	t.context.request.body.lastname = 'Private';
	t.context.request.body.password = 'password';

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.type, 'login');
	t.is(response.error.json.errors[0].meta.error, 'unauthorized');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].lastname, 'Public');
});

test('responds with an error if no password provided', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.lastname = 'Private';

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].lastname, 'Public');
});

test('responds with an error if wrong password provided', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.lastname = 'Private';
	t.context.request.body.password = 'hunter12';

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'match');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].lastname, 'Public');
});

test('responds with an error if new password is insufficient', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.new_password = 'h';
	t.context.request.body.password = 'password';

	const oldSalt = user._salt;

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'password');
	t.is(response.error.json.errors[0].meta.rule, 'minlen');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, await new Hash().hash('password', updatedUser[0]._salt));
	t.not(updatedUser[0]._salt, oldSalt);
});

test('redirects when specified', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.lastname = 'Private';
	t.context.request.body.password = 'password';

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await update(t.context.app, t.context.request, t.context.response);
});

test.serial('does not redirect with failed request', async t => {
	const user = await createUser(t);
	t.context.request.session.user = { _id: user[0]._id, role: 'member' };

	t.context.request.body.lastname = 'Private';
	t.context.request.body.password = 'hunter12';

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = () => {
		t.fail('Should not redirect');
	};

	const response = await update(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);
});
