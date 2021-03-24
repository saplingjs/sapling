const path = require('path');
const Utils = require('../../lib/Utils');

module.exports = () => {
	const app = {
		dir: path.join(__dirname, '../../'),
		config: {
			render: {
				driver: 'html'
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
		hooks: {}
	};

	app.utils = new Utils(app);

	return app;
};
