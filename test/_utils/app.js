const path = require('path');
const Utils = require('../../lib/Utils');

module.exports = () => {
	const app = {
		dir: path.join(__dirname, '../../'),
		config: {
			render: {
				driver: 'html'
			},
			mail: {
				host: 'smtp.example.com',
				port: 465,
				secure: true,
				auth: {
					user: 'john',
					pass: 'abc123'
				}
			},
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
