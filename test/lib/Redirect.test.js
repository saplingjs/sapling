import test from 'ava';

import Redirect from '../../lib/Redirect.js';


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();

	t.context.request = (await import('../_utils/request.js')).default();

	t.context.response = () => {
		const response = {};
		response.redirect = () => {
			t.fail('Response should not redirect');
			return response;
		};
		response.status = () => {
			t.fail('Response should not send a status');
			return response;
		};
		response.send = () => {
			t.fail('Response should not be a view');
			return response;
		};
		response.json = () => {
			t.fail('Response should not be JSON');
			return response;
		};
		return response;
	};
});


test('does not redirect when no query string is passed', t => {
	const response = t.context.response();

	const result = (new Redirect(t.context.app, t.context.request, response)).do();
	t.false(result);
});

test('redirects when redirect query string is passed', async t => {
	t.plan(2);

	t.context.request.query.redirect = '/post';

	return new Promise((resolve) => {
		const response = t.context.response();

		response.redirect = destination => {
			t.is(destination, '/post');
			resolve();
			return response;
		};

		const result = (new Redirect(t.context.app, t.context.request, response)).do();
		t.true(result);
	});
});

test('redirects when goto query string is passed', async t => {
	t.plan(2);

	t.context.request.query.goto = '/post';

	return new Promise((resolve) => {
		const response = t.context.response();

		response.redirect = destination => {
			t.is(destination, '/post');
			resolve();
			return response;
		};

		const result = (new Redirect(t.context.app, t.context.request, response)).do();
		t.true(result);
	});
});

test('prefers redirect over goto', async t => {
	t.plan(2);

	t.context.request.query.redirect = '/post';
	t.context.request.query.goto = '/update';

	return new Promise((resolve) => {
		const response = t.context.response();

		response.redirect = destination => {
			t.is(destination, '/post');
			resolve();
			return response;
		};

		const result = (new Redirect(t.context.app, t.context.request, response)).do();
		t.true(result);
	});
});

test('applies data to params', async t => {
	t.plan(2);

	t.context.request.query.redirect = '/post/:_id';

	return new Promise((resolve) => {
		const response = t.context.response();

		response.redirect = destination => {
			t.is(destination, '/post/15');
			resolve();
			return response;
		};

		const result = (new Redirect(t.context.app, t.context.request, response, { _id: 15, title: 'Hello' })).do();
		t.true(result);
	});
});

test('applies an array of data to params', async t => {
	t.plan(2);

	t.context.request.query.redirect = '/post/:_id';

	return new Promise((resolve) => {
		const response = t.context.response();

		response.redirect = destination => {
			t.is(destination, '/post/15');
			resolve();
			return response;
		};

		const result = (new Redirect(t.context.app, t.context.request, response, [ { _id: 15, title: 'Hello' }, { _id: 20, title: 'Hi' } ])).do();
		t.true(result);
	});
});
