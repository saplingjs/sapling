import test from 'ava';

import Response from '../../lib/Response.js';
import SaplingError from '../../lib/SaplingError.js';
import Templating from '../../lib/Templating.js';

import runHook from '../../core/runHook.js';
import initRoute from '../../core/initRoute.js';


test.beforeEach(async t => {
	t.context.app = (await import('../_utils/app.js')).default();

	t.context.app.runHook = runHook;

	t.context.app.templating = new Templating(t.context.app);

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test('listens on get', t => {
	t.plan(2);

	t.context.app.server.get = (route, handler) => {
		t.is(route, '/app');
	};

	initRoute.call(t.context.app, '/app', 'app.html');

	t.true(t.context.app.routeStack.get.includes('/app'));
});

test('listens on post', t => {
	t.plan(2);

	t.context.app.server.post = (route, handler) => {
		t.is(route, '/app');
	};

	initRoute.call(t.context.app, '/app', 'app.html');

	t.true(t.context.app.routeStack.post.includes('/app'));
});

test.cb('runs handler with existent view', t => {
	t.plan(2);

	t.context.app.server.get = async (route, handler) => {
		const response = await handler(t.context.request, t.context.response);

		t.true(response instanceof Response);
		t.not(response.content, '');
		t.end();
	};

	initRoute.call(t.context.app, '/app', 'index');
});

test.cb('returns error with non-existent view', t => {
	t.plan(2);

	t.context.app.server.get = async (route, handler) => {
		const response = await handler(t.context.request, t.context.response);

		t.true(response instanceof Response);
		t.true(response.error instanceof SaplingError);
		t.end();
	};

	initRoute.call(t.context.app, '/app', 'nonexistent');
});
