var ModelController = Spineless.View.extend({
	template: [
		{text: "Models", className: "heading model"},
		{id: "modelList", className: "list", children: [
			{tag: "button", id: "newpage", className: "button green", text: "New Model"}
		]},

		{className: "new", children: [
			{tag: "label", className: "emph", children: [
				{tag: "span", text: "Model Name: "},
				{tag: "input", id: "name"},
				{tag: "button", id: "add-field", className: "button green", text: "Add Field"}
			]},

			{id: "fieldList"},

			{tag: "button", id: "submit", type: "submit", text: "Create Model"}
		]}
	],

	events: {
		"click add-field": "onAdd",
		"click submit": "onCreate",
		"click newpage": "onNew"
	},

	defaults: {
		"name": ""
	},

	init: function () {
		ModelController.super(this, "init", arguments);

		this.sync("get", "/admin/structure");
		this.once("sync:get", this.onStructure);

		this.on("selected", function (id) {
			this.set("name", id);
			var model = this.structure[id];
			this.load(model);

			this.children.forEach(function (item) {
				item.container.classList.remove("selected");
			});

			this.submit.textContent = "Update Model";
		});
	},

	onStructure: function (structure) {
		this.structure = structure;

		for (var key in structure) {
			this.addChild(new Model({
				superview: this.modelList,
				name: key
			}));
		}
	},

	onAdd: function () {
		var a = new FieldForm({superview: this.fieldList})
		a.onExpand();
		this.addChild(a);

		setTimeout(function () {
			a.name.focus();
			window.scrollTo(0, document.body.scrollHeight);	
		}, 0);
	},

	onNew: function () {
		for (var i = 0; i < this.children.length; ++i) {
			if (this.children[i].tag !== "Field") {
				this.children[i].container.classList.remove("selected");
				continue; 
			}

			this.children[i--].removeFromParent();
		}

		this.set("name", "");
		this.submit.textContent = "Create Model";
		this.name.focus();
	},

	onCreate: function () {
		var structure = {};
		for (var i = 0; i < this.children.length; ++i) {
			// only read Field childs
			console.log(this.children[i].tag)
			if (this.children[i].tag !== "Field") { continue; }

			var model = Spineless.merge(this.children[i].model);

			model.access = {
				r: model['access-read'],
				w: model['access-write']
			};

			delete model['access-read'];
			delete model['access-write'];

			if (model.values) {
				model.values = model.values.split(/\s*,\s*/);
			} else {
				delete model.values;
			}

			if (model.type === "String") {
				if (+model.min) model.minlen = +model.min;
				if (+model.max) model.maxlen = +model.max;

				delete model.min;
				delete model.max;
			} else if (model.type === "Number") {
				if (+model.min) model.min = +model.min;
				else delete model.min;
				if (+model.max) model.max = +model.max;
				else delete model.max;

				model.default = +model.default;
			}

			if (model.default === "") {
				delete model.default;
			}

			structure[model.name] = model;
		}

		this.post("/admin/models", {
			name: this.model.name,
			content: structure//JSON.stringify(structure)
		});

		this.once("sync:post", function () {
			if (this.find({name: this.model.name, tag: "row"}).length) {
				return;
			}

			this.addChild(new Model({
				superview: this.modelList,
				name: this.model.name
			}))
		})

		this.structure[model.name] = model;
		console.log(structure)
	},

	load: function (model) {
		for (var i = 0; i < this.children.length; ++i) {
			if (this.children[i].tag == "Field") {
				this.children[i--].removeFromParent();
			}
		}

		for (var key in model) {
			var f = new FieldForm({
				superview: this.fieldList
			});

			f.load(key, model[key]);
			this.addChild(f);
		}
	}
});

var Model = Spineless.View.extend({
	tag: "row",
	
	template: [
		{tag: "span", id: "name"},
		{id: "cancel", tag: "button", text: "", title: "Remove model"}
	],

	defaults: {
		"name": ""
	},

	events: {
		"click container": "onClick",
		"click cancel": "onCancel"
	},

	onClick: function () {
		this.emit("selected", this.model.name);
		this.container.classList.add("selected");
	},

	onCancel: function () {
		var id = this.delete("/admin/models/" + this.model.name);
		this.once(id, this.removeFromParent);
	},

	render: function () {
		this.name.textContent = this.model.name;
	}
});

var accessOptions = [
	{tag: "option", value: "anyone", text: "Anyone"},
	{tag: "option", value: "stranger", text: "Stranger"},
	{tag: "option", value: "member", text: "Member"},
	{tag: "option", value: "owner", text: "Owner"},
	{tag: "option", value: "admin", text: "Admin"}
];

var FieldForm = Spineless.View.extend({
	template: [
		{className: "header", children: [
			{tag: "strong", text: "▶", id: "expand"},
			{tag: "input", id: "name"},
			{tag: "button", id: "remove", text: "Remove Field", className: "button remove-field"}
		]},

		{id: "properties", children: [

		{tag: "label", children: [
			{tag: "span", text: "Type: "},
			{tag: "select", id: "type", children: [
				{tag: "option", value: "String", text: "Text"},
				{tag: "option", value: "Number", text: "Number"},
				{tag: "option", value: "Boolean", text: "Boolean"}
			]}
		]},

		{className: "sep"},

		{tag: "label", className: "", children: [
			{tag: "span", text: "Min: "},
			{tag: "input", id: "min"}
		]},

		{tag: "label", className: "", children: [
			{tag: "span", text: "Max: "},
			{tag: "input", id: "max"},
			{tag: "span", className: "hint clearer", text: "Minimum length for text or minimum value for number"}
		]},

		{className: "sep"},

		{tag: "label", children: [
			{tag: "span", text: "Allowed Values: "},
			{tag: "input", id: "values"},
			{tag: "span", className: "hint", text: "Seperate values by a comma (,)"}
		]},

		{className: "sep"},

		{tag: "label", children: [
			{tag: "span", text: "Default Value: "},
			{tag: "input", id: "default"}
		]},

		{className: "sep"},

		{tag: "label", className: "floater", children: [
			{tag: "input", type: "checkbox", id: "required"},
			{tag: "span", text: "Required"}
		]},

		{tag: "label", className: "floater", children: [
			{tag: "input", type: "checkbox", id: "unique"},
			{tag: "span", text: "Unique"}
		]},

		{className: "sep clearer"},

		{tag: "label", className: "clearer", children: [
			{tag: "span", text: "Read Access: "},
			{tag: "select", id: "access-read", children: accessOptions}
		]},

		{tag: "label", children: [
			{tag: "span", text: "Write Access: "},
			{tag: "select", id: "access-write", children: accessOptions}
		]},

		{className: "clearer"}

		]}
	],

	defaults: {
		"type": "String",
		"name": "",
		"min": "",
		"max": "",
		"values": "",
		"default": "",
		"required": false,
		"unique": false,
		"access-read": "anyone",
		"access-write": "owner"
	},

	events: {
		"click remove": "removeFromParent",
		"click expand": "onExpand"
	},

	init: function () {
		FieldForm.super(this, "init", arguments);
		this.set("access-write", "owner");
		this.set("access-read", "anyone");
	},

	load: function (key, model) {
		if (typeof model.access === "string") {
			model.access = {r: model.access, w: model.access};
		}

		this.set({
			"name": key,
			"type": model.type,
			"min": model.min || model.minlen,
			"max": model.max || model.maxlen,
			"values": model.values && model.values.join(", "),
			"default": model['default'],
			"required": !!model.required,
			"unique": !!model.unique,
			"access-read": model.access && model.access.r || "anyone",
			"access-write": model.access && model.access.w || "anyone",
		});
	},

	onExpand: function () {
		if (this.properties.style.display == "block") {
			this.properties.style.display = "none";
			this.expand.textContent = "▶";
		} else {
			this.properties.style.display = "block";
			this.expand.textContent = "▼";
		}
	}
}, "Field");

$(".model").click(function () {
	$("#page").empty();
	if (p) {
		p.removeFromParent();
	}

	p = new ModelController({
		superview: "page"
	});	
})