import test from 'ava';

import Response from '../../../lib/Response.js';

import logout from '../../../hooks/sapling/user/logout.js';


test.beforeEach(async t => {
	t.context.app = (await import('../../_utils/app.js')).default();

	t.context.request = (await import('../../_utils/request.js')).default();
	t.context.response = (await import('../../_utils/response.js')).default();
});


test.serial('clears the session and responds', async t => {
	t.plan(2);

	const response = await logout(t.context.app, t.context.request, t.context.response);

	t.is(t.context.request.session, null);
	t.true(response instanceof Response);
});

test.serial('clears the session and redirects', t => {
	t.plan(2);

	const response = t.context.response;

	t.context.request.query.redirect = '/app';
	response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	logout(t.context.app, t.context.request, response);

	t.is(t.context.request.session, null);
});
