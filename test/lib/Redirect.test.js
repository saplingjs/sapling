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

test.cb('redirects when redirect query string is passed', t => {
	t.plan(2);

	t.context.request.query.redirect = '/post';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/post');
		t.end();
		return response;
	};

	const result = (new Redirect(t.context.app, t.context.request, response)).do();
	t.true(result);
});

test.cb('redirects when goto query string is passed', t => {
	t.plan(2);

	t.context.request.query.goto = '/post';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/post');
		t.end();
		return response;
	};

	const result = (new Redirect(t.context.app, t.context.request, response)).do();
	t.true(result);
});

test.cb('prefers redirect over goto', t => {
	t.plan(2);

	t.context.request.query.redirect = '/post';
	t.context.request.query.goto = '/update';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/post');
		t.end();
		return response;
	};

	const result = (new Redirect(t.context.app, t.context.request, response)).do();
	t.true(result);
});

test.cb('applies data to params', t => {
	t.plan(2);

	t.context.request.query.redirect = '/post/:_id';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/post/15');
		t.end();
		return response;
	};

	const result = (new Redirect(t.context.app, t.context.request, response, { _id: 15, title: 'Hello' })).do();
	t.true(result);
});

test.cb('applies an array of data to params', t => {
	t.plan(2);

	t.context.request.query.redirect = '/post/:_id';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/post/15');
		t.end();
		return response;
	};

	const result = (new Redirect(t.context.app, t.context.request, response, [ { _id: 15, title: 'Hello' }, { _id: 20, title: 'Hi' } ])).do();
	t.true(result);
});
