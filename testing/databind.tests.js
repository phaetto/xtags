"use strict";

; (function () { window.Class = window.Class || { module: function (e, t, n) { return (new window.Class.Require).module(t).then(function () { window.Class.Modules.push(e); n.injectMe()() }) }, require: function () { return new Class.Require } }; window.Class.Require = window.Class.Require || function () { function n(n) { e[n] = function () { t.push({ name: n, args: arguments }); return this } } var e = this; var t = []; n("property"); n("module"); n("class"); n("custom"); this.then = function (n) { var r = 50; if (!window.Class.Require.RqL) { setTimeout(function () { e.then(n) }, r) } else { var i = window.Class.require(); for (var s = 0; s < t.length; ++s) { i[t[s].name].apply(i, t[s].args) } i.then(n) } return this } } })();

///////////////////////////////////////////////////////////////////////////////////////////////////
//////          Test cases
///////////////////////////////////////////////////////////////////////////////////////////////////

Class.require().module("Testing module").class("Testing.UI.Context").then(["Testing.UI.Context", function (context) {

    Test.when("Simple databind", "databind").try(function (surface) {
        xTags.AnalyseText("<xml><template><span>#{this.data()}</span></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind({ data: "data-1" });

        this.should.be.equal(1, xtag.Children.length);
        this.should.be.equal("data-1", xtag.Children[0].Children[0].Text);
        this.should.be.equal("<span>data-1</span>", xtag.$().html());
    }).failed(context.printError);

    Test.when("Simple databind with array", "databind").try(function(surface) {
        xTags.AnalyseText("<xml><template><span>#{this.data()}</span></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind([
            { data: "data-1" },
            { data: "data-2" },
            { data: "data-3" }
        ]);

        this.should.be.equal(3, xtag.Children.length);
        this.should.be.equal("data-1", xtag.Children[0].Children[0].Text);
        this.should.be.equal("data-2", xtag.Children[1].Children[0].Text);
        this.should.be.equal("data-3", xtag.Children[2].Children[0].Text);
    }).failed(context.printError);

    Test.when("Simple databind with array and then rebind", "databind").try(function (surface) {
        xTags.AnalyseText("<xml><template><span>#{this.data()}</span></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind([
            { data: "data-1" },
            { data: "data-2" },
            { data: "data-3" }
        ]);

        xtag.Databind([
            { data: "data-4" },
            { data: "data-5" },
        ]);

        this.should.be.equal(2, xtag.Children.length);
        this.should.be.equal("data-4", xtag.Children[0].Children[0].Text);
        this.should.be.equal("data-5", xtag.Children[1].Children[0].Text);
    }).failed(context.printError);

    Test.when("Simple databind with datasource and array", "databind").try(function(surface) {
        xTags.AnalyseText("<xml><template><ul datasource='Rows'><li>#{this.data()}</li></ul></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind({
            Rows: [
                { data: "data-1" },
                { data: "data-2" },
                { data: "data-3" }
            ]
        });

        this.should.be.equal(3, xtag.Children[0].Children.length);
        this.should.be.equal("data-1", xtag.Children[0].Children[0].Children[0].Text);
        this.should.be.equal("data-2", xtag.Children[0].Children[1].Children[0].Text);
        this.should.be.equal("data-3", xtag.Children[0].Children[2].Children[0].Text);
    }).failed(context.printError);

    Test.when("Simple databind with datasource and array, then rebind", "databind").try(function (surface) {
        xTags.AnalyseText("<xml><template><ul datasource='Rows'>  <li>#{this.data()}</li></ul></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind({
            Rows: [
                { data: "data-1" },
                { data: "data-2" },
                { data: "data-3" }
            ]
        });

        xtag.Databind({
            Rows: [
                { data: "data-4" },
                { data: "data-5" }
            ]
        });

        this.should.be.equal(2, xtag.Children[0].Children.length);
        this.should.be.equal("data-4", xtag.Children[0].Children[0].Children[0].Text);
        this.should.be.equal("data-5", xtag.Children[0].Children[1].Children[0].Text);
    }).failed(context.printError);

    Test.when("Input text databind with array / checked field binding", "databind").try(function (surface) {
        xTags.AnalyseText("<xml><template><div><input type='checkbox' value='ok' checked='#{this.isChecked() ? true : false}'>"
            + "</input></div></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind([
            { isChecked: true },
            { isChecked: false },
            { isChecked: true }
        ]);

        this.should.be.equal(3, xtag.Children.length);
        this.should.be.equal(true, xtag.Children[0].Children[0].$()[0].checked);
        this.should.be.equal(false, xtag.Children[1].Children[0].$()[0].checked);
        this.should.be.equal(true, xtag.Children[2].Children[0].$()[0].checked);
    }).failed(context.printError);

    Test.when("Input text databind with array / checked field binding / async using src for events", "databind").try(function (surface) {
        xTags.AnalyseText("<xml><template><div><input type='checkbox' value='ok'>"
            + "<data type='text/javascript-events' src='test.checkbox.events.js'/>"
            + "<data type='text/name-value' name='isChecked'><![CDATA[#{this.isChecked()}]]></data>"
            + "</input></div></template></xml>");

        var xtag = xTags.CreateInstance("template");

        xtag.Create(surface);

        xtag.Databind([
            { isChecked: true },
            { isChecked: false },
            { isChecked: true }
        ]);

        // Todo: must build the event-core using promises; tests must support this as well
        setTimeout($.proxy(function () {
            //this.should.be.equal(3, xtag.Children.length);
            //this.should.be.equal(true, xtag.Children[0].Children[0].$()[0].checked);
            //this.should.be.equal(false, xtag.Children[1].Children[0].$()[0].checked);
            //this.should.be.equal(true, xtag.Children[2].Children[0].$()[0].checked);
        }, this), 100);
    }).failed(context.printError);

    context.wrapUp();
}]);