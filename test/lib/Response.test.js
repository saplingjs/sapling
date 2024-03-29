import test from 'ava';

import Response from '../../lib/Response.js';
import SaplingError from '../../lib/SaplingError.js';


const noAjax = t => {
	t.context.request.xhr = false;
	t.context.request.headers.accept = 'text/html';
}


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


/* convertArrayToTables */

test('returns the proper HTML string for an array of values', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables([1,2,3]), '<table><tbody><tr><td>1</td></tr><tr><td>2</td></tr><tr><td>3</td></tr></tbody></table>');
});

test('returns the proper HTML string for an array of objects', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables([{foo:'bar'},{foo:'baz'}]), '<table><tbody><tr><th>foo</th><td>bar</td></tr></tbody></table><table><tbody><tr><th>foo</th><td>baz</td></tr></tbody></table>');
});

test('returns the proper HTML string for a single object with single key', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables({foo:'bar'}), '<table><tbody><tr><th>foo</th><td>bar</td></tr></tbody></table>');
});

test('returns the proper HTML string for a single object with multiple keys', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables({foo:'bar',baz:'qux'}), '<table><tbody><tr><th>foo</th><td>bar</td></tr><tr><th>baz</th><td>qux</td></tr></tbody></table>');
});

test('returns the proper HTML string for a multi-dimensional array', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables([1,2,[3,4]]), '<table><tbody><tr><td>1</td></tr><tr><td>2</td></tr><tr><td><table><tbody><tr><td>3</td></tr><tr><td>4</td></tr></tbody></table></td></tr></tbody></table>');
});

test('returns the proper HTML string for a multi-dimensional object', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables([{foo:[{bar:'baz'},{bar:'qux'}]}]), '<table><tbody><tr><th>foo</th><td><table><tbody><tr><th>bar</th><td>baz</td></tr></tbody></table><table><tbody><tr><th>bar</th><td>qux</td></tr></tbody></table></td></tr></tbody></table>');
});

test('returns the proper HTML string for a boolean value', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables(true), '<table><tbody><tr><th>Return value</th><td>true</td></tr></tbody></table>');
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables(false), '<table><tbody><tr><th>Return value</th><td>false</td></tr></tbody></table>');
});

test('returns the proper HTML string for a string value', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables('John'), '<table><tbody><tr><td>John</td></tr></tbody></table>');
});

test('returns the proper HTML string for a number value', t => {
	t.is((new Response(t.context.app, t.context.request)).convertArrayToTables(42), '<table><tbody><tr><td>42</td></tr></tbody></table>');
});


/* getRecordsFound */

test('returns appropriate label for 1 record found', t => {
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([{foo:'bar'}]), '1 record found');
});

test('returns appropriate label for multiple records found', t => {
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([{foo:'bar'},{foo:'bar'}]), '2 records found');
});

test('returns appropriate label for no records found', t => {
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([]), '0 records found');
});

test('returns appropriate label for 1 record affected', t => {
	t.context.request.method = 'POST';
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([{foo:'bar'}]), '1 record affected');
});

test('returns appropriate label for multiple records affected', t => {
	t.context.request.method = 'POST';
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([{foo:'bar'},{foo:'bar'}]), '2 records affected');
});

test('returns appropriate label for no records affected', t => {
	t.context.request.method = 'POST';
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound([]), '0 records affected');
});

test('returns appropriate label for a single record', t => {
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound({foo:'bar'}), '1 record found');
});

test('returns empty string for bad data', t => {
	t.is((new Response(t.context.app, t.context.request)).getRecordsFound('bar'), '');
});


/* viewResponse */

test.cb('responds with a view when pre-rendered HTML is passed', t => {
	noAjax(t);

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.is(data, '<h1>Hello</h1>');
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, '<h1>Hello</h1>');
});

test.cb('responds with data JSON when a string of data is passed', t => {
	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.json = data => {
		t.deepEqual(data, [{foo:"bar"}]);
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, '[{"foo":"bar"}]');
});

test.cb('responds with a data view when a string of data is passed', t => {
	noAjax(t);

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.true(data.includes('Response to'));
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, '[{"foo":"bar"}]');
});


/* genericResponse */

test.cb('responds with a generic success status when no content is passed', t => {
	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.send = data => {
		t.true(data.success);
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null);
});


/* dataResponse */

test.cb('redirects when redirect query string is passed', t => {
	t.context.request.query.redirect = '/my-account';

	const response = t.context.response();

	response.redirect = destination => {
		t.is(destination, '/my-account');
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, []);
});

test.cb('responds with data JSON when data is passed', t => {
	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.json = data => {
		t.deepEqual(data, [{foo:'bar'}]);
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, [{foo:'bar'}]);
});

test.cb('responds with a data view when data is passed', t => {
	noAjax(t);

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 200);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.true(data.includes('Response to'));
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, null, [{foo:'bar'}]);
});


/* errorResponse */

test.cb('responds with an error JSON when an error is passed', t => {
	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 500);
		return response;
	};
	response.json = data => {
		t.is(data.errors.length, 1);
		t.end();
		return response;
	};

	new Response(t.context.app, t.context.request, response, new SaplingError('error'));
});

test.cb('responds with an error view when an error is passed', t => {
	noAjax(t);
	t.context.app.config.showError = true;

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 500);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.true(data.includes('SaplingError'));
		t.end();
		return response;
	};
	
	new Response(t.context.app, t.context.request, response, new SaplingError('error'));
});

test.cb('responds with a plain error view when an error is passed', t => {
	noAjax(t);
	t.context.app.config.showError = false;

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 500);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.true(data.includes('A critical error has occurred with this website.  Please try again later.'));
		t.end();
		return response;
	};
	
	new Response(t.context.app, t.context.request, response, new SaplingError('error'));
});


/* notFoundResponse */

test.cb('responds with a 404 status when an empty content is passed', t => {
	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 404);
		return response;
	};
	response.send = data => {
		t.falsy(data);
		t.end();
		return response;
	};
	
	new Response(t.context.app, t.context.request, response, null, false);
});

test.cb('responds with a 404 error view when an empty content is passed', t => {
	noAjax(t);

	const response = t.context.response();

	response.status = statusCode => {
		t.is(statusCode, 500);
		return response;
	};
	response.send = data => {
		t.is(typeof data, 'string');
		t.true(data.includes('This page either does not exist, or you do not have permission to see it.'));
		t.end();
		return response;
	};
	
	new Response(t.context.app, t.context.request, response, null, false);
});
