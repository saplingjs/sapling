var PageController = Spineless.View.extend({
	template: [
		{text: "Pages", className: "heading page"},

		{id: "pageList", className: "list", children: [
			{tag: "button", id: "newpage", className: "button green", text: "New Page"}
		]},

		{className: "new page", children: [
			{tag: "label", children: [
				{tag: "span", text: "Page Name: "},
				{tag: "input", id: "name"},		
			]},

			{tag: "textarea", id: "content"},

			{tag: "button", id: "submit", type: "submit", text: "Create Page"}
		]}
	],

	events: {
		"click submit": "onSubmit",
		"click newpage": "onNew"
	},

	defaults: {
		"name": "",
		"content": ""
	},

	init: function () {
		Page.super(this, "init", arguments);

		this.sync("get", "/admin/views");
		this.once("sync:get", this.onViews);

		this.on("selected", this.onSelect);
	
		this.cm = CodeMirror.fromTextArea(this.content, {
			mode: "mustache",
			lineNumbers: true,
			autofocus: true,
			viewportMargin: Infinity,
			lineWrapping: true,
			smartIndent: false,
			electricChars: false
		});	

		setTimeout(function () {
			this.cm.focus();
			this.cm.refresh();
		}.bind(this), 0)
	},

	onViews: function (views) {
		for (var i = 0; i < views.length; ++i) {
			var n = views[i].substring(0, views[i].lastIndexOf("."))
			this.addChild(new Page({
				superview: this.pageList,
				name: n
			}));
		}
	},

	onSubmit: function () {
		this.model.content = this.cm.getValue();
		
		this.post("/admin/views");
		this.once("sync:post", function (resp) {
			console.log("POST", this.model.name)

			this.children.forEach(function (item) {
				item.container.classList.remove("selected");
			});
			
			//exists already
			var exists = this.find({name: this.model.name});
			if (exists.length) {
				exists[0].container.classList.add("selected");
				return;
			}

			var p = new Page({
				superview: this.pageList,
				name: this.model.name
			});

			p.container.classList.add("selected");

			this.addChild(p);
		});
	},

	onNew: function () {
		this.set("content", "");
		this.set("name", "");
		this.cm.setValue("");
		this.children.forEach(function (item) {
			item.container.classList.remove("selected");
		});
		this.submit.textContent = "Create Page";
		this.name.focus();
	},

	onSelect: function (view) {
		var id = this.sync("get", "/admin/views/" + encodeURIComponent(view));
		this.set("name", view);

		this.on("sync:" + id, function (resp) {
			this.set("content", resp)
			this.cm.setValue(resp)
			this.cm.focus();
		});

		this.children.forEach(function (item) {
			item.container.classList.remove("selected");
		});

		this.submit.textContent = "Update Page";
	}
});

var Page = Spineless.View.extend({
	tag: "row",
	
	defaults: {
		name: ""
	},

	template: [
		{tag: "span", id: "name"},
		{id: "cancel", tag: "button", text: "", title: "Remove page"}
	],

	events: {
		"click container": "onClick",
		"click cancel": "onCancel"
	},

	onClick: function () {
		this.emit("selected", this.model.name);
		this.container.classList.add("selected");
	},

	onCancel: function () {
		var id = this.delete("/admin/views/" + encodeURIComponent(this.model.name));
		this.once(id, this.removeFromParent);
	},

	render: function () {
		this.name.textContent = this.model.name;
	}
});

$(".page").click(function () {
	$("#page").empty();
	if (p) {
		p.removeFromParent();
	}

	p = new PageController({
		superview: "page"
	});
});