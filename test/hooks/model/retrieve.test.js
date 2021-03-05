const test = require('ava');
const _ = require('underscore');

const Response = require('../../../lib/Response');
const SaplingError = require('../../../lib/SaplingError');
const Storage = require('../../../lib/Storage');

const retrieve = require('../../../hooks/sapling/model/retrieve');


test.beforeEach(t => {
	t.context.app = _.defaults({
		storage: new Storage({}, {
			name: 'test',
			schema: {},
			config: { db: { driver: 'Memory' } },
			dir: __dirname
		})
	}, require('../../_utils/app')());

	t.context.request = require('../../_utils/request')();
	t.context.response = require('../../_utils/response')();
});


test('fetches the correct model', async t => {
	t.context.app.storage.schema.posts = {
		'title': { type: 'string', required: true, maxlen: 140 },
		'body': 'string'
	};
	t.context.request.params.model = 'posts';

	const response = await retrieve(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('title' in response.content);
	t.true('body' in response.content);
});

test('fetches the correct model with hidden values', async t => {
	t.context.app.storage.schema.users = {
		'email': { type: 'string', required: true, email: true },
		'password': { type: 'string', required: true },
		'_salt': 'string'
	};
	t.context.request.params.model = 'users';

	const response = await retrieve(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(_.isObject(response.content));
	t.true('email' in response.content);
	t.true('password' in response.content);
	t.false('_salt' in response.content);
});

test('fails when no model name provided', async t => {
	const response = await retrieve(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
	t.is(response.error.message, 'No model specified');
});

test('fails with non-existent model', async t => {
	t.context.request.params.model = 'nonexistent';

	const response = await retrieve(t.context.app, t.context.request, t.context.response);

	t.true(response instanceof Response);
	t.true(response.error instanceof SaplingError);
	t.is(response.error.message, 'No such model');
});
