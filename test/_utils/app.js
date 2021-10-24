import path from 'path';
import { fileURLToPath } from 'url';

import Utils from '../../lib/Utils.js';

export default () => {
	const app = {
		dir: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../'),
		config: {
			render: {
				driver: 'html'
			},
			db: {
				driver: 'Memory'
			},
			hooksDir: 'hooks/',
			viewsDir: 'views/',
			extension: 'html'
		},
		opts: {
			port: 3000
		},
		server: {
			get: () => true,
			post: () => true,
			use: () => true
		},
		routeStack: {
			get: [],
			post: []
		},
		hooks: {},
		schema: {}
	};

	app.utils = new Utils(app);

	return app;
};
