import test from 'ava';
import _ from 'underscore';
import path from 'path';
import { fileURLToPath } from 'url';

import parseMethodRouteKey from '../../core/parseMethodRouteKey.js';
import runHook from '../../core/runHook.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));


test.beforeEach(async t => {
	t.context.app = _.defaults({
		dir: __dirname
	}, (await import('../_utils/app.js')).default());

	t.context.app.parseMethodRouteKey = parseMethodRouteKey;

	t.context.request = (await import('../_utils/request.js')).default();
	t.context.response = (await import('../_utils/response.js')).default();
});


test('runs defined hook', t => {
	t.plan(1);

	t.context.app.hooks = {
		'GET /test': () => {
			t.pass();
		}
	};

	runHook.call(t.context.app, 'get', '/test', t.context.request, t.context.response, {}, () => t.fail());
});

test('does not run unrelated hooks', t => {
	t.plan(1);

	t.context.app.hooks = {
		'GET /test': () => {
			t.pass();
		},
		'POST /test': () => {
			t.fail();
		}
	};

	runHook.call(t.context.app, 'get', '/test', t.context.request, t.context.response, {}, () => t.fail());
});

test('runs nothing when no hooks are found', t => {
	t.plan(1);

	t.context.app.hooks = {
		'POST /test': () => {
			t.fail();
		}
	};

	runHook.call(t.context.app, 'get', '/test', t.context.request, t.context.response, {}, () => t.pass());
});

test('passes all attributes properly', t => {
	t.plan(5);

	t.context.app.hooks = {
		'GET /test': (app, request, response, data, next) => {
			t.true(_.isObject(app));
			t.is(request, 1);
			t.is(response, 2);
			t.is(data, 3);
			t.is(typeof next, 'function');
		}
	};

	runHook.call(t.context.app, 'get', '/test', 1, 2, 3, () => t.fail());
});
