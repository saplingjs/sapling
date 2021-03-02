const test = require('ava');
const path = require('path');

const Response = require('../../../lib/Response');

const logout = require('../../../hooks/sapling/user/logout');


test.beforeEach(t => {
	t.context.app = {
		dir: path.join(__dirname, '../../'),
		config: {
			render: {
				driver: 'html'
			}
		}
	};

	t.context.request = {
		session: {
			destroy: () => true
		},
		query: {}
	};

	t.context.response = () => {
		const response = {};
		response.redirect = () => {
			return response;
		};
		response.status = () => {
			return response;
		};
		response.send = () => {
			return response;
		};
		response.json = () => {
			return response;
		};
		return response;
	};
});


test.serial('clears the session and responds', async t => {
	t.plan(2);

	const response = await logout(t.context.app, t.context.request, t.context.response());

	t.is(t.context.request.session, null);
	t.true(response instanceof Response);
});

test.serial('clears the session and redirects', t => {
	t.plan(2);

	const response = t.context.response();

	t.context.request.query.redirect = '/app';
	response.redirect = destination => {
		t.is(destination, t.context.request.query.redirect);
	};

	logout(t.context.app, t.context.request, response);

	t.is(t.context.request.session, null);
});
