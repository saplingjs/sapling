import test from 'ava';
import _ from 'underscore';

import runHook from '../../core/runHook.js';


test.beforeEach(t => {
	t.context.app = _.defaults({
		dir: __dirname
	}, require('../_utils/app')());

	t.context.app.parseMethodRouteKey = require('../../core/parseMethodRouteKey');

	t.context.request = require('../_utils/request')();
	t.context.response = require('../_utils/response')();
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
