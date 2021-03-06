const test = require('ava');
const _ = require('underscore');

const Hash = require('../../../lib/Hash');
const Response = require('../../../lib/Response');
const SaplingError = require('../../../lib/SaplingError');
const Storage = require('../../../lib/Storage');
const User = require('../../../lib/User');

const forgot = require('../../../hooks/sapling/user/forgot');
const recover = require('../../../hooks/sapling/user/recover');


const requestReset = async t => {
	const user = await t.context.app.storage.db.write('users', {
		email: 'john@example.com',
		username: 'john',
		password: 'yOw6Npt/UQaeq/eFxd3JVp/XPwO3PvFBEu48pe1X5SfMnThjVhv1+b+ENj7H3oCcQU/8TrZvxdYfUR9JEtzrp32/l0ctGGaximt4St+BGne6TzA+rFe4qR0dV1PTfHO47NFwly2PQYbzPGfuMjBI2rKHXfIOsz497HtQLyXjdus=',
		_salt: '4pLu1G6DwMeBS9bXN4QuoNu44m4uPt5PBzoZKXwzAbHlKA/kbl9lnn71IHyASW4QUEdq63qX2O7oObLRnv/6ddNH3dunoQPJZuDV/3FTjLC8bwzEG3AtDhcriXr8ANIlvQ0c6IXxarQ2WdbeDVi3FdkRGMtLVTjPx7Yobo/FCqc=',
		role: 'member'
	});

	t.context.request.body.email = 'john@example.com';
	await forgot(t.context.app, t.context.request, t.context.response);
	delete t.context.request.body.email;

	return await t.context.app.storage.db.read('users', { _id: user[0]._id });
};


test.beforeEach(t => {
	t.context.app = _.extend({
		name: 'untitled'
	}, require('../../_utils/app')());

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


test('changes the user password', async t => {
	const user = await requestReset(t);

	const oldSalt = user[0]._salt;
	const oldPassword = user[0].password;

	t.context.request.body.new_password = 'hunter12';
	t.context.request.body.auth = user[0]._authkey;

	const response = await recover(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.not(response.content[0]._salt, oldSalt);
	t.not(response.content[0].password, oldPassword);

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, await new Hash().hash('hunter12', updatedUser[0]._salt));
	t.not(updatedUser[0]._salt, oldSalt);
});

test('responds with an error if no authkey provided', async t => {
	const user = await requestReset(t);

	t.context.request.body.new_password = 'hunter12';

	const response = await recover(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.key, 'auth');
	t.is(response.error.json.errors[0].meta.rule, 'required');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, user[0].password);
});

test('responds with an error if expired authkey provided', async t => {
	const user = await requestReset(t);

	let key = (Date.now() - (2 * 60 * 60 * 9000) ).toString(16);
	key += t.context.app.utils.randString();

	t.context.request.body.new_password = 'hunter12';
	t.context.request.body.auth = key;

	const response = await recover(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.type, 'recover');
	t.is(response.error.json.errors[0].meta.error, 'expired');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, user[0].password);
});

test('responds with an error if invalid authkey provided', async t => {
	const user = await requestReset(t);

	let key = (Date.now() + (2 * 60 * 60 * 1000)).toString(16);
	key += t.context.app.utils.randString();

	t.context.request.body.new_password = 'hunter12';
	t.context.request.body.auth = key;

	const response = await recover(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);

	t.is(response.error.json.errors[0].meta.type, 'recover');
	t.is(response.error.json.errors[0].meta.error, 'invalid');

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, user[0].password);
});

test('redirects when specified', async t => {
	t.plan(3);

	const user = await requestReset(t);

	const oldSalt = user[0]._salt;
	const oldPassword = user[0].password;

	t.context.request.body.new_password = 'hunter12';
	t.context.request.body.auth = user[0]._authkey;

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	await recover(t.context.app, t.context.request, t.context.response);

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, await new Hash().hash('hunter12', updatedUser[0]._salt));
	t.not(updatedUser[0]._salt, oldSalt);
});

test.serial('does not redirect with failed request', async t => {
	t.plan(4);

	const user = await requestReset(t);

	const oldSalt = user[0]._salt;
	const oldPassword = user[0].password;

	t.context.request.body.new_password = 'hunter12';

	t.context.request.query.redirect = '/app';

	t.context.response.redirect = () => {
		t.fail('Should not redirect');
	};

	const response = await recover(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.falsy(response.content);
	t.true(response.error instanceof SaplingError);

	const updatedUser = await t.context.app.storage.db.read('users', { _id: user[0]._id });
	t.is(updatedUser[0].password, user[0].password);
});
