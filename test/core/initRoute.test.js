const test = require('ava');

const Response = require('../../lib/Response');
const SaplingError = require('../../lib/SaplingError');
const Templating = require('../../lib/Templating');

const initRoute = require('../../core/initRoute');


test.beforeEach(t => {
	t.context.app = require('../_utils/app')();

	t.context.app.runHook = require('../../core/runHook');

	t.context.app.templating = new Templating(t.context.app);

	t.context.request = require('../_utils/request')();
	t.context.response = require('../_utils/response')();
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
