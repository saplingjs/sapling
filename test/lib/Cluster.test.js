import test from 'ava';

import cluster from 'cluster';
import { default as strip } from 'strip-ansi';

import Cluster from '../../lib/Cluster.js';


test.beforeEach(t => {
	process.env.NODE_ENV = 'local';
});


test('prints console log', t => {
	console.log = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()} log item`));
	};

	Cluster.console.log('log item');
});

test('prints console warning', t => {
	console.warn = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()} warning item`));
	};

	Cluster.console.warn('warning item');
});

test('prints console error', t => {
	console.error = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()} error item`));
	};

	Cluster.console.error('error item');
});

test('prints access log', t => {
	const date = new Date().toISOString();
	t.is(strip(Cluster.logger({
		date: () => date,
		method: () => 'GET',
		url: () => '/',
		status: () => 304,
		'response-time': () => 5.767
	}, {}, {})), strip(`${Cluster.workerID()} [${date}] GET / 304 5.767 ms`));
});

test('prints correct worker ID', t => {
	t.is(strip(Cluster.workerID()), strip(`[W${cluster.worker ? cluster.worker.id : 0}/${process.pid}]`));
});

test('prints wakeup message', t => {
	console.log = msg => {
		t.is(strip(msg), strip(`Worker ${cluster.worker ? cluster.worker.id : 0} (${process.pid}) now listening on port 4000`));
	};

	Cluster.listening(4000);
});

test.serial('prints group header', t => {
	console.log = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()} Group`));
	};

	Cluster.console.group('Group');
});

test.serial('prints indented log item in group', t => {
	console.log = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()}     Grouped item`));
	};

	Cluster.console.log('Grouped item');
});

test.serial('prints non-indented group item after group', t => {
	console.log = (...args) => {
		const msg = Array.from(args).join(' ');
		t.is(strip(msg), strip(`${Cluster.workerID()} Ungrouped item`));
	};

	Cluster.console.groupEnd();
	Cluster.console.log('Ungrouped item');
});


test('does not print console log during tests', t => {
	process.env.NODE_ENV = 'test';

	console.log = () => {
		t.fail('Log should not be printed');
	};

	Cluster.console.log('log item');

	t.pass();
});

test('does not print console warning during tests', t => {
	process.env.NODE_ENV = 'test';

	console.warn = () => {
		t.fail('Warning should not be printed');
	};

	Cluster.console.warn('log item');

	t.pass();
});

test('does not print console error during tests', t => {
	process.env.NODE_ENV = 'test';

	console.error = () => {
		t.fail('Error should not be printed');
	};

	Cluster.console.error('log item');

	t.pass();
});

test('does not print access log during tests', t => {
	process.env.NODE_ENV = 'test';

	const date = new Date().toISOString();
	t.is(typeof Cluster.logger({
		date: () => date,
		method: () => 'GET',
		url: () => '/',
		status: () => 304,
		'response-time': () => 5.767
	}, {}, {}), 'undefined');
});

test('does not print wakeup message during tests', t => {
	process.env.NODE_ENV = 'test';

	console.log = () => {
		t.fail('Wakeup should not be printed');
	};

	Cluster.listening(4000);

	t.pass();
});

test.serial('does not print group header during tests', t => {
	process.env.NODE_ENV = 'test';

	console.log = () => {
		t.fail('Group header should not be printed');
	};

	Cluster.console.group('Group');

	t.pass();
});

test.serial('does not print indented log item in group during tests', t => {
	process.env.NODE_ENV = 'test';

	console.log = () => {
		t.fail('Grouped item should not be printed');
	};

	Cluster.console.log('Grouped item');

	t.pass();
});


test.after.always(t => {
	process.env.NODE_ENV = 'test';
});
