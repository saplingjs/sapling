export default () => {
	return {
		xhr: true,
		method: 'GET',
		url: '',
		originalUrl: '',
		query: {},
		body: {},
		params: {},
		headers: {},
		session: {
			destroy: () => true
		},
		csrfToken: () => 'abc'
	};
};
