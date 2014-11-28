"use strict";

; (function () { window.Class = window.Class || { module: function (e, t, n) { return (new window.Class.Require).module(t).then(function () { window.Class.Modules.push(e); n.injectMe()() }) }, require: function () { return new Class.Require } }; window.Class.Require = window.Class.Require || function () { function n(n) { e[n] = function () { t.push({ name: n, args: arguments }); return this } } var e = this; var t = []; n("property"); n("module"); n("class"); n("custom"); this.then = function (n) { var r = 50; if (!window.Class.Require.RqL) { setTimeout(function () { e.then(n) }, r) } else { var i = window.Class.require(); for (var s = 0; s < t.length; ++s) { i[t[s].name].apply(i, t[s].args) } i.then(n) } return this } } })();

Class.module("Testing module", [], function () {
    function add(obj, name, method) {
        var values;
        if (name.indexOf('.') > -1)
            values = name.split('.');
        else
            values = [name];

        if (values[0] === "window")
            values.splice(0, 1);

        var deepObj = obj;
        for (var j = 0; j < values.length - 1; ++j) {
            if (!deepObj[values[j]]) {
                deepObj[values[j]] = {};
            }
            deepObj = deepObj[values[j]];
        }

        deepObj[values[values.length - 1]] = function () {
            method.apply(obj, arguments);
        };
    }

    window.Class.define("Test.Report", function() {
        if (window["Test.Report"]) {
            return window["Test.Report"];
        }

        this.categories = {};
        this.failedTests = [];

        if (window.localStorage["Test.Report.FailedTests"]) {
            this.failedTests = JSON.parse(window.localStorage["Test.Report.FailedTests"]);
        }

        this.succeeded = function(name, categoryName) {
            this.categories[categoryName] = this.categories[categoryName]
                || { succeeded: 0, failed: 0 };
            ++this.categories[categoryName].succeeded;
        };

        this.failed = function (name, categoryName) {
            this.categories[categoryName] = this.categories[categoryName]
                || { succeeded: 0, failed: 0 };
            ++this.categories[categoryName].failed;

            window.localStorage["Test.Report.RunOnlyFailed"] = 'yes';
            this.failedTests.push(name);
            window.localStorage["Test.Report.FailedTests"] = JSON.stringify(this.failedTests);
        };

        this.runOnlyFailedTests = function() {
            return window.localStorage["Test.Report.RunOnlyFailed"] === 'yes' && this.failedTests.length > 0;
        };

        this.runAllTests = function () {
            window.localStorage.removeItem("Test.Report.RunOnlyFailed");
            window.localStorage.removeItem("Test.Report.FailedTests");
        };

        window["Test.Report"] = this;

        return this;
    });

    window.Class.define("Test.Case", function (name, categoryName, Test$Report) {
        // Todo : When some fail, run only those, and put an option to disable it - run everything when all failed succeeds
        // Todo: option to keep or remove UI for failed tests (show only html produced? find a better way?)

        var failed = false;
        this.reason = null;
        this.name = name;
        this.categoryName = categoryName;
        var surface = $("body").append("<div class='test-surface'>").find(".test-surface").last();

        // Todo: make those into objects for autocomplete
        add(this, "should.not.be.null", function (o) {
            this.validate(o !== null && typeof (o) !== "undefined", "Value is null or undefined.");
        });

        add(this, "should.be.nullOrUndefined", function (o) {
            this.validate(o === null || typeof (o) === "undefined", "Value is defined (it shouldn't).");
        });

        add(this, "should.be.null", function (o) {
            this.validate(o === null, "Value is not null.");
        });

        add(this, "should.be.undefined", function (o) {
            this.validate(typeof (o) === "undefined", "Value is not undefined.");
        });

        add(this, "should.be.equal", function (o1, o2) {
            this.validate(o1 === o2, "Values do not match. Expected: " + o1 + " - Actual: " + o2);
        });

        add(this, "should.be.true", function (o) {
            this.validate(o === true, "Value should be true.");
        });

        add(this, "should.be.false", function (o) {
            this.validate(o === false, "Value should be false.");
        });

        add(this, "$", function () {
            window.Class.require().property("$").then(function () {
                return $(Test$Report.root);
            });
        });

        this.validate = function (bool, reason) {
            if (!bool) {
                failed = true;
                this.reason = reason;

                console.error("'" + this.name + "' assumption failed:" + this.reason);

                $(surface).show();
            }

            return this;
        };

        this.try = function (theTest) {
            if (Test$Report.runOnlyFailedTests() && Test$Report.failedTests.indexOf(this.name) === -1) {
                return this;
            }

            Class.inject(theTest).apply(this, [surface]);

            if (failed) {
                console.error("'" + this.name + "' test failed:" + this.reason);
                Test$Report.failed(this.name, this.categoryName);
            } else {
                console.log("'" + this.name + "' test succeeded.");
                Test$Report.succeeded(this.name, this.categoryName);
            }

            return this;
        };

        this.success = function (onsuccess) {
            if (!failed) {
                Class.inject(onsuccess).apply(this);
            }
            return this;
        };

        this.failed = function(onfail) {
            if (failed) {
                Class.inject(onfail).apply(this);
            }
            return this;
        };

        return this;
    });

    window.Test.when = function (name, categoryName) {
        return new Test.Case(name, categoryName);
    };
});