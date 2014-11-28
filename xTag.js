/******************************************************************************************************
 * 
 * xTags javascript library
 * 2012+ Copyright Alexander Mantzoukas, Modern Software Design
 *
 * Version: 0.9.3.10
 * Publisher: Modern Software Design, Alexander Mantzoukas
 * Site: http://www.msd.am/xTags/, Code trust domain: http://xtags.msd.am
 * License: MIT or GPL
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, 
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. * 
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR 
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR 
 * OTHER DEALINGS IN THE SOFTWARE.
 *
******************************************************************************************************/

"use strict";

///////////////////////////////////////////////////////////////////////////////////////////////////////
// xTags module code
///////////////////////////////////////////////////////////////////////////////////////////////////////

(function () {
    var $;

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Base definitions: classes, dependency injection, promises and requirement patterns
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    
    /* Use this code to safely load async 'require' and requirements:
    (window.require=window.require||function(b){var a=50;if(!window.RqL){setTimeout(function(){window.require(b,function(){return 1},a)},a)}else{b()}})(function(){
    });
    */

    function navigateToObject(name) {
        var obj = window;
        var values;
        if (name.indexOf('.') > -1)
            values = name.split('.');
        else
            values = [name];
        if (values[0] === "window")
            values.splice(0, 1);
        for (var j = 0; j < values.length - 1; ++j) {
            if (!obj[values[j]])
                return null;
            obj = obj[values[j]];
        }

        return obj[values[values.length - 1]];
    }

    window.Class = {};

    window.Class.getClass = function (name) {
        if (typeof (name) !== "string") {
            return name;
        }

        return navigateToObject(name);
    };

    window.Class.isOfType = function (theClass, requiredClass) {
        if (typeof (requiredClass) !== "function") return false;

        theClass = window.Class.getClass(theClass);
        requiredClass = window.Class.getClass(requiredClass);

        var base = theClass.base;
        while (typeof (base) === "function" && base != requiredClass) {
            base = base.base;
        }

        return base == requiredClass;
    };

    window.Class.define = function (name, base, func) {
        var obj = window;
        var values;
        if (name.indexOf('.') > -1)
            values = name.split('.');
        else
            values = [name];

        if (values[0] === "window")
            values.splice(0, 1);
        for (var j = 0; j < values.length - 1; ++j) {
            if (!obj[values[j]])
                obj[values[j]] = {};
            obj = obj[values[j]];
        }

        if (typeof (base) !== "undefined" && typeof (func) === "undefined") {
            func = base;
            base = null;
        }

        func = obj[values[values.length - 1]] = window.Class.inject(func);

        if (base) {
            var rootFunc = typeof (base) === "string" ? window.Class.getClass(base) : base;
            func.prototype = new rootFunc();
            func.prototype.className = name;
            func.prototype.base = rootFunc;
        }

        return func;
    };

    (function () {
        var customInjectionHash = {};
        var stripComments = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
        var dotReplace = /\$/ig;

        window.Class.map = function (name, classInjected) {
            customInjectionHash[name] = classInjected;
        };

        window.Class.inject = function (func) {

            if (func.isInjectionWrapped)
                return func;
        
            var parameterNames = (function (func) {
                var funStr = func.toString();
                funStr = funStr.replace(stripComments, '');
                return funStr.slice(funStr.indexOf('(') + 1, funStr.indexOf(')')).match(/([^\s,]+)/g) || [];
            })(func);

            var result = function () {
                var params = [];
                for (var i = 0; i < parameterNames.length; ++i) {
                    var className = parameterNames[i].replace(dotReplace, ".");

                    if (typeof (customInjectionHash[className]) === "function") {
                        params[i] = new customInjectionHash[className]();
                    } else {
                        var classFunc = Class.getClass(className);
                        if (classFunc && className.indexOf(".") > -1) {
                            if (typeof (classFunc) === "function")
                                params[i] = new classFunc();
                            else
                                params[i] = classFunc;
                        } else
                            params[i] = arguments[i];
                    }
                }

                return func.apply(this, params);
            };

            result.isInjectionWrapped = true;
            return result;
        };

        Function.prototype.injectMe = function () {
            return window.Class.inject(this);
        };
    })();

    window.Class.define("window.Class.promise", function (callback, options) {
        var self = this;
        options = options || {};
        this.callback = callback.injectMe();
        this.futurePromise = null;
        this.first = this;
        var isResolved = false;
        var failed = false;
        var canBeWhenResolved = true;
        var hasNormalResolved = false;
        this.when = function (requirement, failureCondition, timeout) {
            if (failed || isResolved)
                return;

            if (typeof (requirement) === "function") {
                canBeWhenResolved = false;
                if (!timeout) timeout = 100;
                setTimeout(function () {
                    if (requirement() && (hasNormalResolved || self.first === self)) {
                        canBeWhenResolved = true;
                        self.resolve();
                        return;
                    }
                    if (typeof (failureCondition) === "function" && failureCondition()) {
                        self.fail();
                        return;
                    }
                    self.when(requirement, failureCondition, timeout + 50);
                }, timeout);
            } else if (requirement instanceof Class.promise) {
                this.when(requirement.isResolved, requirement.isFailed, timeout);
            }
            return this;
        };
        this.then = function (nextCallback) {
            if (typeof (nextCallback) === "function")
                this.futurePromise = new Class.promise(nextCallback);
            else
                this.futurePromise = nextCallback;
            this.futurePromise.first = this.first;

            if (isResolved)
                this.futurePromise.resolve();

            return this.futurePromise;
        };
        this.onfail = function (errorCallback) {
            errorCallback = errorCallback.injectMe();
            if (typeof (options.error) === "function") {
                var previousError = options.error;
                options.error = function () {
                    previousError.apply(self, arguments);
                    errorCallback.apply(self, arguments);
                };
            } else options.error = errorCallback;
            return this;
        };
        this.resolve = function () {
            hasNormalResolved = true;
            if (failed || isResolved || !canBeWhenResolved)
                return;
            (function () {
                if (typeof (this.timeoutHandle) !== "undefined")
                    clearTimeout(this.timeoutHandle);
                this.callback.apply(this.futurePromise || this, arguments);
                isResolved = true;
            }).apply(self, arguments);
        };
        this.fail = function () {
            if (failed || isResolved)
                return;
            (function () {
                if (typeof (this.timeoutHandle) !== "undefined")
                    clearTimeout(this.timeoutHandle);
                if (options && typeof (options.error) === "function")
                    options.error.apply(this, arguments);
                failed = true;
                if (this.futurePromise) {
                    this.futurePromise.fail.apply(this.futurePromise, arguments);
                    delete this.futurePromise;
                    this.first = this.futurePromise = null;
                }
            }).apply(self, arguments);
        };
        this.promise = function () {
            return self;
        };
        this.isResolved = function () {
            return isResolved;
        };
        this.isFailed = function () {
            return failed;
        };

        var timeout = options.timeout ? options.timeout : 20000;
        if (typeof (timeout) === "number" && timeout > 0) {
            this.timeoutHandle = setTimeout(function () {
                self.fail();
            }, timeout);
        }
        return this;
    });

    Function.prototype.promise = function (options) {
        return new window.Class.promise(this, options);
    };

    window.require = function (namesOrCallback, requirement, timeout) {
        if (typeof (namesOrCallback) === "string")
            namesOrCallback = [namesOrCallback];

        if (typeof (namesOrCallback) === "object" && typeof (namesOrCallback.length) === "number") {
            return window.require(requirement, function () {
                for (var i = 0; i < namesOrCallback.length; ++i) {
                    var o = navigateToObject(namesOrCallback[i]);
                    if (typeof (o) === "undefined" || o === null)
                        return false;
                }

                return true;
            });
        }

        if (typeof (requirement) === "undefined" || requirement === null) {
            return namesOrCallback.promise().when(function () {
                return true;
            }, null, timeout);
        }

        return namesOrCallback.promise().when(requirement, null, timeout);
    };

    window.RqL = true;
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // xTag API and object model
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    window.Class.define("xTag", function(options) {
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Object properties
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        this.TagName = "div";
        this.ParentTag = this.MainTag = this.RootTag = null;
        this.XmlNode = null;
        this.Children = [];
        this.NamedTagsNames = [];
        this.Data = {};
        this.DefaultData = {};
        this.Events = {};
        this.Attributes = {};
        this.DefaultAttributes = {};
        this.Mode = xTags.Mode.Normal;
        this.ModeType = null;
        this.Element = null;
        this.xTemplate = null;
        this.Text = null;
        this.DefaultText = null;
        this.PhraseId = null;
        this.PhraseLibrary = null;
        this.LCID = -1;
        this.Id = null;
        this.ServerOrigin = null;
        this.Session = null;
        this.ApiKey = null;
        this.Token = null;
        this.ParentIndex = -1;
        this.Version = null;
        this.DataSource = null;
        this.DataObject = null;
        // Private members
        var _loadingCounter = 0;
        var _loadCalled = false;
        var _methodsEnabled = false;

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Loading async resources
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.IncrementCounter = function() {
            ++_loadingCounter;
        };
        this.DecrementCounter = function() {
            if (_loadingCounter === 0 && !_loadCalled) {
                _loadCalled = true;

                // Set up the functions get/set/default for data-values
                this.EnableMethods();

                if (!this.Session && typeof(window.localStorage) != "undefined")
                    this.Session = window.localStorage.getItem(this.GetId() + '::Session');

                // If it is logged in, enable it
                if (this.Session) {
                    var session = this.Session;
                    this.Session = null;
                    this.SetSession(session);
                }

                this.TriggerEvent('onReady');

                if (this.ParentTag)
                    this.ParentTag.DecrementCounter();
            } else --_loadingCounter;
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // DOM / API
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.Create = function(element, lcid) {
            if (this.TagName === "#text") {
                // Create the text in the correct language
                this.SetLCID(lcid);
                this.ParentTag.DecrementCounter();
                return;
            }

            this.Element = document.createElement(this.TagName);

            // Apply attributes
            for (var prop in this.Attributes) {
                if (!this.Data[prop])
                    $(this.Element).attr(prop, this.Attributes[prop]);
                else
                    $(this.Element).attr(prop, this.Data[prop]);
            }

            // Append to page
            if (!this.ParentTag) {
                $(element).append(this.Element);
            } else {
                $(this.ParentTag.Element).append(this.Element);
            }

            this.LCID = lcid ? lcid : -1;

            // Render children
            for (var i = 0; i < this.Children.length; ++i) {
                this.IncrementCounter();
                this.Children[i].ParentIndex = i;
                this.Children[i].Create(null, lcid);
            }

            this.TriggerEvent('onCreate');
            this.DecrementCounter();
        };
        this.Attach = function() {
            if (this.TagName === "#text") {
                this.ParentTag.DecrementCounter();
                return;
            }

            if (this.ParentTag) {
                this.RootTag = this.ParentTag.RootTag;

                if (this.ParentIndex < 0) {
                    for (var i = 0; i < this.ParentTag.Children.length; ++i) {
                        if (this.ParentTag.Children[i] === this) {
                            this.ParentTag.Children[i] = newTag;
                            this.ParentIndex = i;
                            break;
                        }
                    }
                }
            }

            for (var i = 0; i < this.Children.length; ++i) {
                this.IncrementCounter();
                this.Children[i].ParentIndex = i;
                this.Children[i].Attach();
            }

            this.TriggerEvent('onAttach');
            this.TriggerEvent('onCreate');
            this.DecrementCounter();
        };
        this.Delete = function(propagated) {
            this.TriggerEvent('onBeforeDelete');

            // Remove events
            if (typeof($(this.Element).off) == "function")
                $(this.Element).off();
            else
                $(this.Element).unbind();

            // Replace global id if exists
            if (this.Id)
                xTags.All[this.Id] = null;

            for (var i = 0; i < this.Children.length; ++i) {
                this.Children[i].Delete(true);
            }

            // Change also the named links
            if (this.Attributes.name && this.MainTag && this.MainTag[this.Attributes.name] === this) {
                this.MainTag[this.Attributes.name] = null;
            }

            if (!propagated) {
                var childIndex = -1;
                if (this.ParentTag) {
                    for (var i = 0; i < this.ParentTag.Children.length; ++i) {
                        if (this.ParentTag.Children[i] === this) {
                            this.ParentTag.Children.splice(i, 1);
                            break;
                        }
                    }
                    this.ParentTag = null;
                }

                $(this.Element).remove();
                this.Element = null;
            }

            this.TriggerEvent('onDelete');
        };
        this.Switch = function(newTag, appendNamedContents) {
            if (typeof newTag === "string") {
                newTag = xTags.CreateInstance(newTag);
            }

            newTag.MainTag = this.MainTag;
            // Change also the named links
            if (this.Attributes.name) {
                newTag.MainTag[this.Attributes.name] = newTag;
                newTag.Attributes.name = this.Attributes.name;
            }

            var childIndex = -1;
            if (this.ParentTag) {
                // Make sure to replace tag and Children
                newTag.ParentTag = this.ParentTag;
                newTag.RootTag = this.RootTag;

                for (var i = 0; i < this.ParentTag.Children.length; ++i) {
                    if (this.ParentTag.Children[i] === this) {
                        this.ParentTag.Children[i] = newTag;
                        newTag.ParentIndex = i;
                        childIndex = i;
                        break;
                    }
                }
            }

            // Replace global id if exists
            if (this.Id)
                xTags.All[this.Id] = newTag;

            // Now remove the old one and add the new one
            if (this.Element) {
                if (!newTag.Element)
                    newTag.Create(this.Element.parentNode, this.LCID);

                // Append contents if exists and match with names
                if (appendNamedContents) {
                    for (var i = 0; i < this.NamedTagsNames.length; ++i) {
                        if (newTag[this.NamedTagsNames[i]]) {
                            for (var j = 0; j < newTag[this.NamedTagsNames[i]].Children.length; ++j) {
                                newTag[this.NamedTagsNames[i]].Children[j].Delete();
                            }
                            for (var j = 0; j < this[this.NamedTagsNames[i]].Children.length; ++j) {
                                newTag[this.NamedTagsNames[i]].Append(this[this.NamedTagsNames[i]].Children[j]);
                            }
                        }
                    }
                }

                $(this.Element).after(newTag.Element);
                this.Delete();
            }

            // Set the correct language now
            newTag.SetLCID(this.LCID);
        };
        this.Append = function(newTag) {
            if (typeof newTag === "string") {
                newTag = xTags.CreateInstance(newTag);
                newTag.SetLCID(this.LCID);
            }

            newTag.ParentIndex = this.Children.length;
            this.Children.push(newTag);
            newTag.ParentTag = this;
            newTag.RootTag = this.RootTag;
            if (this.xTemplate) newTag.MainTag = this;
            else newTag.MainTag = this.MainTag;

            if (newTag.Attributes.name)
                newTag.MainTag[newTag.Attributes.name] = newTag;

            if (this.Element) {
                if (!newTag.Element) {
                    newTag.Create(this.Element, this.LCID);
                } else {
                    if (newTag.Element.parentNode !== this.Element)
                        $(this.Element).append(newTag.Element);
                }
            }

            newTag.TriggerEvent('onAppend', [newTag]);
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Localization
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.SetLCID = function(lcid) {
            lcid = lcid ? lcid : -1;

            if (this.TagName !== "#text") {
                this.LCID = lcid;

                /* TODO: phrases in attributes */

                for (var i = 0; i < this.Children.length; ++i) {
                    this.Children[i].SetLCID(lcid);
                }

                this.TriggerEvent('onLanguageChange');

                return;
            }

            if (this.Element && this.LCID === lcid)
                return;

            var text = "";
            if (this.PhraseId) {
                var p = xTags.GetPhrase(this.PhraseId, lcid);
                // If we find it, skip the library registration
                if (this.PhraseLibrary && p) this.PhraseLibrary = null;

                // Delay load library here if we do not have the phrase and we have a link
                if (this.PhraseLibrary && !p) {
                    $.ajax(xTags.GetCorrectUri(this.PhraseLibrary, this, "xml"), {
                        cache: false,
                        dataType: xTags.GetCorrectType(this.PhraseLibrary, this),
                        timeout: 600000,
                        success: $.proxy(function(txt, textStatus, jqXHR) {
                            this.PhraseLibrary = null;
                            xTags.AnalyseText(txt);
                            this.SetLCID(lcid);
                        }, this),
                        error: $.proxy(function(jqXHR, textStatus, errorThrown) {
                            // Cannot be loaded. Do not try again
                            this.PhraseLibrary = null;
                            this.SetLCID(lcid);
                            this.TriggerEvent('onPhraseLibraryError');
                        }, this)
                    });
                    return;
                }

                text = p ? p : this.Text;
            } else {
                if (this.Element) return; // No phrase: no refresh
                text = this.Text;
            }

            this.LCID = lcid;

            var txtNode = document.createTextNode(text);
            if (this.Element) {
                $(this.Element).after(txtNode);
                $(this.Element).remove();
            } else
                $(this.ParentTag.Element).append(txtNode);

            this.Element = txtNode;
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Databind
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        this.hasBindingRE = /#\{([^\{\}]*?)\}/;

        // Callbacks
        this.RebindProperty = function(property, newValue) {
            if (property === "Text" && this.TagName === "#text") {
                this.Text = xTags.ReplaceBindings(this.DefaultText, newValue, this, "Text");
                if (this.Element) {
                    var txtNode = document.createTextNode(this.Text);
                    $(this.Element).after(txtNode);
                    $(this.Element).remove();
                    this.Element = txtNode;
                }
            }
        };
        this.RebindAttribute = function(property, newValue) {
            this.Attributes[property] = xTags.ReplaceBindings(this.DefaultAttributes[property], newValue, this, null, property);
            if (this.Element) {
                if (property == "value")
                    $(this.Element).val(this.Attributes[property]);
                else
                    $(this.Element).attr(property, this.Attributes[property]);
            }
        };
        this.RebindDataValue = function(property, newValue) {
            this.Data[property] = xTags.ReplaceBindings(this.DefaultData[property], newValue, this, null, null, property);
            if (this.Element && this.Attributes[property]) {
                this.Attributes[property] = this.Data[property];
                $(this.Element).attr(property, this.Attributes[property]);
            }
        };
        this.RebindStructure = function(newValue) {
            this.Databind(newValue);
        }; // Databind methods
        this.Databind = function(newObj) {
            if (typeof(newObj) !== "undefined") {
                this.DataObject = newObj;
            }

            var obj = this.GetDataObject();
            if (obj !== null) {
                // Values
                for (var prop in this.DefaultData) {
                    if (this.hasBindingRE.test(this.DefaultData[prop]))
                        this.RebindDataValue(prop, obj);
                }

                // Attributes
                for (var prop in this.DefaultAttributes) {
                    if (this.hasBindingRE.test(this.DefaultAttributes[prop]))
                        this.RebindAttribute(prop, obj);
                }

                // Text
                if (this.TagName === "#text" && this.hasBindingRE.test(this.DefaultText)) {
                    this.RebindProperty("Text", obj);
                }

                var boundObj = obj;
                var hasBeenDatasourced = false;
                if (this.DataSource &&
                    this.DataSource != "this") {
                    if (obj.selectNodes) {
                        // Xml node
                        boundObj = obj.selectNodes(this.DataSource);
                        hasBeenDatasourced = true;
                    } else if (typeof(obj[this.DataSource]) === "function") {
                        // Find the property that is been bound
                        boundObj = obj[this.DataSource](); // xTags.TravelObservableProperties(obj, this.DataSource);
                        hasBeenDatasourced = true;
                    } else {
                        boundObj = null;
                    }
                }

                if (boundObj !== null && this.XmlNode) {
                    if (typeof(boundObj) === "object") {
                        // Subscribe to structural events
                        if (obj._IsObservable)
                            obj.Subscribe(this.DataSource, null, null, null, this);

                        var nodeToReproduce = this.xTemplate ? xTags.GetTemplateNode(this.xTemplate) : this.XmlNode;

                        // Analyse object been bound
                        if (typeof(boundObj.length) === "number") {
                            var totalChildIndex = 0;
                            for (var j = 0; j < boundObj.length; ++j) {
                                for (var i = 0; i < nodeToReproduce.childNodes.length; ++i) {
                                    if (nodeToReproduce.childNodes[i].nodeType === 1 &&
                                        nodeToReproduce.childNodes[i].tagName !== "data") {
                                        if (totalChildIndex < this.Children.length) {
                                            this.Children[totalChildIndex].DataObject = boundObj[j];
                                        } else {
                                            var cTag = xTags.MakeTemplateNode(null, nodeToReproduce.childNodes[i], this.MainTag, this, this.RootTag);
                                            if (cTag) {
                                                cTag.DataObject = boundObj[j];
                                                this.Append(cTag);
                                            }
                                        }
                                        ++totalChildIndex;
                                    } else if (nodeToReproduce.childNodes[i].nodeType === 3 || nodeToReproduce.childNodes[i].nodeType === 4) {
                                        if (i === 0 ||
                                            nodeToReproduce.childNodes[i - 1].nodeType === 3 ||
                                            nodeToReproduce.childNodes[i - 1].nodeType === 4)
                                            ++totalChildIndex;
                                    }
                                }
                            }

                            for (var i = totalChildIndex; i < this.Children.length;) {
                                this.Children[i].Delete();
                            }
                        } else {
                            // One object
                            var xmlIndex = 0;
                            for (var i = 0; i < nodeToReproduce.childNodes.length; ++i) {
                                if (nodeToReproduce.childNodes[i].nodeType === 1 &&
                                    nodeToReproduce.childNodes[i].tagName !== "data") {
                                    if (xmlIndex < this.Children.length) {
                                        this.Children[xmlIndex].DataObject = null;
                                    } else {
                                        var cTag = xTags.MakeTemplateNode(null, nodeToReproduce.childNodes[i], this.MainTag, this, this.RootTag);
                                        if (hasBeenDatasourced)
                                            cTag.DataObject = boundObj;
                                        if (cTag) {
                                            this.Append(cTag);
                                        }
                                    }
                                    ++xmlIndex;
                                }
                            }
                        }
                    }
                }

                this.TriggerEvent('onDatabind');
            } else if (boundObj === null) {
                // Unbind values, attributes, text and children with datasource

                // Values
                for (var prop in this.DefaultData) {
                    if (this.hasBindingRE.test(this.DefaultData[prop]))
                        this.RebindDataValue(prop, boundObj);
                }

                // Attributes
                for (var prop in this.DefaultAttributes) {
                    if (this.hasBindingRE.test(this.DefaultAttributes[prop]))
                        this.RebindAttribute(prop, boundObj);
                }

                // Text
                if (this.TagName === "#text" && this.hasBindingRE.test(this.DefaultText)) {
                    this.RebindProperty("Text", boundObj);
                }

                if (this.DataSource) {
                    for (var i = 0; i < this.Children.length;) {
                        this.Children[i].Delete();
                    }
                }

                this.TriggerEvent('onDatabind');
            }

            for (var i = 0; i < this.Children.length; ++i) {
                this.Children[i].Databind();
            }

            this.TriggerEvent('onDatabound');
        };
        this.GetDataObject = function() {
            if (!this.DataObject) {
                if (this.ParentTag)
                    return this.ParentTag.GetDataObject();
                else
                    return null;
            }

            if (!this.DataObject._IsObservable)
                this.DataObject = xTags.Observable(this.DataObject);

            return this.DataObject;
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // REST for server model
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        // Reloading from server with ajax; redraws the UI object
        this.Send = function(data, onload, onerror, method) {
            if (this.Mode !== xTags.Mode.Server)
                throw new Error("Tag " + this.GetId() + " is not set to mode 'server'.");

            if (!this.Token) {
                // Need to make an ajax get to find the token first
                this.GetValues({ "xtags-token": "xtags-token" }, function() {
                    if (!this.Token)
                        throw new Error("Failure: CSRF Token could not be retrieved.");
                    this.Send(data, onload, onerror, method);
                });
                return;
            }

            var uri = xTags.GetCorrectRestUri(this.ServerOrigin, this);
            var type = xTags.GetCorrectType(this.ServerOrigin, this);
            if (!data) data = {};

            if (type !== "jsonp") {
                if (method.toLowerCase() === "put" || method.toLowerCase() === "delete") {
                    data["xtags-http-method"] = method;
                    method = "POST";
                }
            } else {
                data["xtags-http-method"] = method;
                method = "GET";
            }

            $.ajax(uri, {
                cache: false,
                type: method,
                data: this.GatherDataString(data),
                dataType: type,
                timeout: 600000,
                success: $.proxy(function(txt) {
                    if (txt.indexOf('xtags-renew-token') > -1) {
                        var newData = $.parseJSON(txt);
                        if (this.Token != newData["xtags-renew-token"]) {
                            // The token has been resent - set the token and make one more request
                            this.Token = newData["xtags-renew-token"];
                            this.Send(data, onload, onerror, method);
                            return;
                        }
                    }

                    var ntag = (function() {
                        var _z = null;
                        return eval("(function() { " + txt + "; return _z;})()");
                    })();

                    this.Switch(ntag);
                    if (onload)
                        $.proxy(onload, ntag)();
                }, this),
                error: $.proxy(function(jqXHR, textStatus, errorThrown) {
                    // xError here when not supported?
                    if (onerror)
                        $.proxy(onerror, this)(jqXHR, textStatus, errorThrown);
                }, this)
            });
            return;
        };
        // Communicating with the server only changing the javascript object on return
        this.SendValues = function(data, onload, onerror, method) {
            if (this.Mode !== xTags.Mode.Server)
                throw new Error("Tag " + this.GetId() + " is not set as a server tag.");
            console.log("1: " + this.ServerOrigin);

            if (!this.Token && (!data || !data["xtags-token"])) {
                // Need to make an ajax get to find the token first
                this.GetValues({ "xtags-token": "xtags-token" }, function() {
                    if (!this.Token)
                        throw new Error("Failure: CSRF Token could not be retrieved.");
                    this.SendValues(data, onload, onerror, method);
                });
                return;
            }

            var uri = xTags.GetCorrectRestUri(this.ServerOrigin, this);
            var type = xTags.GetCorrectType(this.ServerOrigin, this);
            if (!data) data = {};

            if (type !== "jsonp") {
                if (method.toLowerCase() === "put" || method.toLowerCase() === "delete") {
                    data["xtags-http-method"] = method;
                    method = "POST";
                }
            } else {
                data["xtags-http-method"] = method;
                method = "GET";
            }

            data["xtags-values-only"] = "xtags-values-only";

            $.ajax(uri, {
                cache: false,
                type: method,
                data: this.GatherDataString(data),
                dataType: type,
                timeout: 600000,
                success: $.proxy(function(txt) {
                    var newData = $.parseJSON(txt);

                    if (newData) {
                        if (newData["xtags-renew-token"]) {
                            // The token has been resent - set the token and make one more request
                            this.Token = newData["xtags-renew-token"];
                            this.SendValues(data, onload, onerror, method);
                            return;
                        }

                        for (var prop in newData) {
                            if (prop.indexOf("xtags-") != 0) {
                                if (!this.Data[prop])
                                    this.Data[prop] = "";
                            }
                        }

                        this.EnableDataMethods();

                        for (var prop in newData) {
                            if (prop === "xtags-token" || prop === "xtags-new-token") {
                                this.Token = newData[prop];
                            } else if (prop === "xtags-session") {
                                if (this.MainTag)
                                    this.MainTag.SetSession(newData[prop]);
                                else
                                    this.SetSession(newData[prop]);
                            } else {
                                // Use the API to set values
                                var cprop = "set" + prop.charAt(0).toUpperCase() + prop.slice(1);
                                this[cprop](newData[prop]);
                            }
                        }
                    }

                    if (onload)
                        $.proxy(onload, this)();
                    this.TriggerEvent('onLoadValues');
                }, this),
                error: $.proxy(function(jqXHR, textStatus, errorThrown) {
                    // xError here when not supported?
                    if (onerror)
                        $.proxy(onerror, this)(jqXHR, textStatus, errorThrown);
                }, this)
            });
            return;
        };
        // Communicating with the server and returns empty response
        this.SendNoResponse = function(data, onload, onerror, method) {
            if (this.Mode !== xTags.Mode.Server)
                throw new Error("Tag " + this.GetId() + " is not set as a server tag.");

            if (!this.Token) {
                // Need to make an ajax get to find the token first
                this.GetValues({ "xtags-token": "xtags-token" }, function() {
                    if (!this.Token)
                        throw new Error("Failure: CSRF Token could not be retrieved.");
                    this.SendNoResponse(data, onload, onerror, method);
                });
                return;
            }

            var uri = xTags.GetCorrectRestUri(this.ServerOrigin, this);
            var type = xTags.GetCorrectType(this.ServerOrigin, this);
            if (!data) data = {};

            if (type !== "jsonp") {
                if (method.toLowerCase() === "put" || method.toLowerCase() === "delete") {
                    data["xtags-http-method"] = method;
                    method = "POST";
                }
            } else {
                data["xtags-http-method"] = method;
                method = "GET";
            }

            data["xtags-no-response"] = "xtags-no-response";

            // Ajax request with no response
            $.ajax(uri, {
                cache: false,
                type: method,
                data: this.GatherDataString(data),
                dataType: type,
                timeout: 600000,
                success: function(txt) {
                    if (txt && txt.indexOf('xtags-renew-token') > -1) {
                        var newData = $.parseJSON(txt);
                        if (this.Token != newData["xtags-renew-token"]) {
                            // The token has been resent - set the token and make one more request
                            this.Token = newData["xtags-renew-token"];
                            this.SendNoResponse(data, onload, onerror, method);
                            return;
                        }
                    }

                    if (onload)
                        $.proxy(onload, this)();
                },
                error: function() {
                    if (onerror)
                        $.proxy(onerror, this)();
                }
            });
            return;
        };
        // Simplified definitions
        this.Get = function(data, onload, onerror) {
            this.Send(data, onload, onerror, "GET");
        };
        this.Post = function(data, onload, onerror) {
            this.Send(data, onload, onerror, "POST");
        };
        this.Put = function(data, onload, onerror) {
            this.Send(data, onload, onerror, "PUT");
        };
        this.PostDelete = function(data, onload, onerror) {
            this.Send(data, onload, onerror, "DELETE");
        };
        this.GetValues = function(data, onload, onerror) {
            this.SendValues(data, onload, onerror, "GET");
        };
        this.PostValues = function(data, onload, onerror) {
            this.SendValues(data, onload, onerror, "POST");
        };
        this.PutValues = function(data, onload, onerror) {
            this.SendValues(data, onload, onerror, "PUT");
        };
        this.DeleteValues = function(data, onload, onerror) {
            this.SendValues(data, onload, onerror, "DELETE");
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Login model / Security
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.Login = function(parentTag) {
            var xLoginTag = this.CreateSpecialTag("xLogin");
            if (!xLoginTag)
                xLoginTag = this.CreateSpecialTag("xLoaderFail");
            if (parentTag)
                parentTag.Append(xLoginTag);
            else if (this.MainTag)
                this.MainTag.Append(xLoginTag);
            else
                this.Append(xLoginTag);

            this.TriggerEvent('onLoginStart');
        };
        this.Logout = function(parentTag) {
            if (parentTag)
                parentTag.SetSession(null);
            else if (this.MainTag)
                this.MainTag.SetSession(null);
            else
                this.SetSession(null);
        };
        this.SetSession = function(session) {
            if (!session) session = null;
            if (this.Session !== session) {
                this.Session = session;

                if (window.localStorage) {
                    if (this.Session)
                        window.localStorage.setItem(this.GetId() + '::Session', this.Session);
                    else
                        window.localStorage.removeItem(this.GetId() + '::Session');
                }

                if (session)
                    this.TriggerEventAndPropagate('onLogin');
                else
                    this.TriggerEventAndPropagate('onLogout');
            }
        };
        this.GetSession = function() {
            if (!this.Session) {
                // Use session-storage to get semi-persisted value
                if (window.localStorage) {
                    this.Session = window.localStorage.getItem(this.GetId() + '::Session');
                    if (this.Session)
                        return this.Session;
                }

                if (this.ParentTag)
                    return this.ParentTag.GetSession();
                else
                    return null;
            }

            return this.Session;
        };
        this.GetApiKey = function() {
            if (!this.ApiKey) {
                if (this.ParentTag)
                    return this.ParentTag.GetApiKey();
                else
                    return null;
            }

            return this.ApiKey;
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Persistence
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.Load = function() {
            if (this.Data && window.localStorage) {
                this.TriggerEvent('onBeforeLoad');

                var id = this.GetId();
                for (var prop in this.Data) {
                    var cprop = "set" + prop.charAt(0).toUpperCase() + prop.slice(1);
                    if (this[cprop]) {
                        var item = window.localStorage.getItem(id + '.' + prop);
                        if (typeof(item) !== "undefined") {
                            try {
                                this[cprop](JSON.parse(item));
                            } catch(e) {
                                this[cprop](item);
                            }
                        }
                    }
                }

                for (var i = 0; i < this.Children.length; ++i) {
                    this.Children[i].Load();
                }

                this.TriggerEvent('onLoad');
            }
        };
        this.Save = function() {
            if (this.Data && window.localStorage) {
                this.TriggerEvent('onBeforeSave');

                var id = this.GetId();
                for (var prop in this.Data) {
                    if (this.Data[prop] !== null && typeof(this.Data[prop]) !== "undefined")
                        window.localStorage.setItem(id + '.' + prop, JSON.stringify(this.Data[prop]));
                    else
                        window.localStorage.removeItem(id + '.' + prop);
                }

                for (var i = 0; i < this.Children.length; ++i) {
                    this.Children[i].Save();
                }

                this.TriggerEvent('onSave');
            }
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Various Helpers
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        this.GetId = function() {
            if (this.Id)
                return this.Id;

            if (this.Attributes.name) {
                if (this.MainTag)
                    return this.MainTag.GetId() + ":" + this.Attributes.name;

                return this.xTemplate + ":" + this.Attributes.name;
            }

            if (this.Attributes["class"]) {
                if (this.MainTag)
                    return this.MainTag.GetId() + "." + this.Attributes["class"];

                return this.xTemplate + "." + this.Attributes["class"];
            }

            var childIndex = -1;
            if (this.ParentTag) {
                return this.ParentTag.GetId() + "." + this.ParentIndex;
            } else {
                return this.xTemplate + ".0";
            }
        };
        this.GatherDataString = function(data, prefix) {
            var dataString = "";
            for (var prop in this.Data) {
                if (data && !data.hasOwnProperty(prop))
                    dataString += (dataString ? "&" : "") + encodeURIComponent(prop) + "=" + encodeURIComponent(this.Data[prop]);
            }

            if (data) {
                for (var prop in data) {
                    if (data[prop])
                        dataString += (dataString ? "&" : "") + encodeURIComponent(prop) + "=" + encodeURIComponent(data[prop]);
                }
            }

            var standardData = {
                "xtags-xajax": "xtags-xajax",
                "xtags-id": this.GetId(),
                "xtags-session": this.GetSession(),
                "xtags-apikey": this.GetApiKey(),
                "xtags-token": this.Token
            };

            for (var prop in standardData) {
                if (standardData[prop])
                    dataString += (dataString ? "&" : "") + prop + "=" + encodeURIComponent(standardData[prop]);
            }

            if (prefix && dataString)
                return prefix + "&" + dataString;
            else if (prefix)
                return prefix;
            return dataString;
        };
        this.GetParentByTemplateName = function(templateName) {
            var tags = [];

            if (this.ParentTag) {
                if (this.ParentTag.xTemplate === templateName)
                    return this.ParentTag;
                return this.ParentTag.GetParentByTemplateName(templateName);
            }

            return null;
        };
        this.GetTagsByTemplateName = function(templateName) {
            var tags = [];

            if (this.xTemplate === templateName)
                tags.push(this);

            for (var i = 0; i < this.Children.Count; ++i) {
                var newTags = this.Children[i].GetTagByTemplateName(templateName);
                for (var j = 0; j < newTags.length; ++j)
                    tags.push(newTags[j]);
            }

            return tags;
        };
        this.GetTagById = function(id) {
            if (this.GetId() === id)
                return this;

            for (var i = 0; i < this.Children.Count; ++i) {
                var tag = this.Children[i].GetTagById(id);
                if (tag)
                    return tag;
            }

            return null;
        };
        this.EnableMethods = function() {
            if (_methodsEnabled)
                return;
            _methodsEnabled = true;

            // Attach jquery or object events
            for (var prop in this.Events) {
                if (typeof(this.Events[prop]) === "function")
                    this.AddEvent(prop, this.Events[prop]);
            }

            if (this.xTemplate && typeof(xTags.Extensions[this.xTemplate]) === "object") {
                // Register extension events on this object
                for (var extProp in xTags.Extensions[this.xTemplate]) {
                    if (typeof(xTags.Extensions[this.xTemplate][extProp]) === "function")
                        this.AddEvent(extProp, xTags.Extensions[this.xTemplate][extProp]);
                }
            }

            this.EnableDataMethods();
        };
        this.EnableDataMethods = function() {
            // Set up the functions get/set/default for data-values
            if (this.Data) {
                for (var prop in this.Data) {
                    var cprop = prop.charAt(0).toUpperCase() + prop.slice(1);

                    if (this.Attributes.hasOwnProperty(prop)) {
                        // Values connected to attributes - attributes have higher priority
                        this["get" + cprop] = (function() {
                            var lprop = prop;
                            return function() {
                                if (lprop === "value")
                                    return (this.Attributes[lprop] = this.Data[lprop] = $(this.Element).val());

                                return (this.Attributes[lprop] = this.Data[lprop] = $(this.Element).attr(lprop));
                            };
                        }());
                        this["set" + cprop] = (function() {
                            var lprop = prop;
                            return function(value) {
                                if (lprop === "value")
                                    $(this.Element).val(value);
                                else
                                    $(this.Element).attr(lprop, value);
                                this.Attributes[lprop] = this.Data[lprop] = value;
                            };
                        }());
                        this["reset" + cprop] = (function() {
                            var lprop = prop;
                            return function() {
                                if (lprop === "value")
                                    $(this.Element).val(this.DefaultData[lprop]);
                                else
                                    $(this.Element).attr(lprop, this.DefaultData[lprop]);
                                this.Attributes[lprop] = this.Data[lprop] = this.DefaultData[lprop];
                            };
                        }());
                    } else {
                        // Only values
                        this["get" + cprop] = (function() {
                            var lprop = prop;
                            return function() {
                                return this.Data[lprop];
                            };
                        }());
                        this["set" + cprop] = (function() {
                            var lprop = prop;
                            return function(value) {
                                this.Data[lprop] = value;
                            };
                        }());
                        this["reset" + cprop] = (function() {
                            var lprop = prop;
                            return function() {
                                this.Data[lprop] = this.DefaultData[lprop];
                            };
                        }());
                    }
                }
            }
        };
        this.AddEvent = function(name, method) {
            var oldMethod = method;
            var _tag = this;
            if ($(this.Element)[name] && name !== 'ready') {
                // Setup track
                method = function(e) {
                    var _event = e;
                    setTimeout(function() {
                        try {
                            xTags.Events.OnTrack(_tag, name, _event);
                        } catch(e) {
                        }
                    }, 0);

                    return oldMethod.apply(_tag, arguments);
                };

                // Setup with jquery
                if (typeof($(this.Element).on) === "function")
                    $(this.Element).on(name, method);
                else
                    $(this.Element).bind(name, method);
            } else {
                // Setup event
                var cprop = name;
                if (cprop.indexOf('on') != 0)
                    cprop = "on" + name.charAt(0).toUpperCase() + name.slice(1);

                // Setup track
                method = function() {
                    setTimeout(function() {
                        try {
                            xTags.Events.OnTrack(_tag, cprop, { "isXTagsEvent": true });
                        } catch(e) {
                        }
                    }, 0);

                    return oldMethod.apply(_tag, arguments);
                };

                this.Events[cprop] = method;
                if (cprop != name && typeof(this.Events[name]) !== "undefined")
                    delete this.Events[name];
            }
        };
        this.RemoveEvent = function(name) {
            if ($(this.Element)[name] && name != 'ready') {
                if (typeof($(this.Element).off) == "function")
                    $(this.Element).off(name);
                else
                    $(this.Element).unbind(name);

                delete this.Events[name];
            } else {
                var cprop = name;
                if (prop.indexOf('on') != 0)
                    cprop = "on" + name.charAt(0).toUpperCase() + name.slice(1);
                delete this.Events[cprop];
            }
        };
        this.TriggerEvent = function(name, parameters) {
            if (!parameters) parameters = [];
            var cprop = name;
            if (cprop.indexOf('on') != 0)
                cprop = "on" + name.charAt(0).toUpperCase() + name.slice(1);
            if (this.Events[cprop])
                this.Events[cprop].apply(this, parameters);
        };
        this.TriggerEventAndPropagate = function(name, parameters) {
            this.TriggerEvent(name, parameters);

            for (var i = 0; i < this.Children.length; ++i) {
                this.Children[i].TriggerEventAndPropagate(name, parameters);
            }
        };
        this.CreateSpecialTag = function(name) {
            var xtemplate = (this.xTemplate ? this.xTemplate : (this.MainTag ? this.MainTag.xTemplate : null));
            var templateNode = xtemplate ? xTags.GetTemplateNode(xtemplate) : null;
            var correctNode = xTags.GetTemplateNodeOrDefault(templateNode, name);
            if (correctNode)
                return xTags.MakeTemplateNode(null, correctNode, null, null, this.RootTag);
            return null;
        };
        this.$ = function() {
            if (!this.Element)
                return null;
            return $(this.Element);
        };

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Options setting
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        if (options) {
            if (options.Id) {
                this.Id = options.Id;
                xTags.All[this.Id] = this; // Options problem here ?
            }

            if (options.TagName)
                this.TagName = options.TagName;

            if (options.Data) {
                for (var prop in options.Data) {
                    this.Data[prop] = this.DefaultData[prop] = options.Data[prop];
                }
            }

            if (options.LCID)
                this.LCID = options.LCID;

            if (options.ServerOrigin)
                this.ServerOrigin = options.ServerOrigin;

            if (options.Session)
                this.Session = options.Session;

            if (options.ApiKey)
                this.ApiKey = options.ApiKey;

            if (options.DataSource)
                this.DataSource = options.DataSource;

            if (options.Events) {
                for (var prop in options.Events) {
                    this.AddEvent(prop, options.Events[prop]);
                }
            }
        }

        return this;
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // xTags global orchestration
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    window.xTags = {
        Mode: {
            Normal: 0,
            Browser: 1,
            Server: 2
        },
        Events: {
            OnCustomData: function (tag, xmlNode, dataValueNode) { },
            OnTrack: function (tag, eventName, eventData) { }
        },
        Extensions: {},
        All: {},
        Templates: {},
        DefaultTemplates: {},
        Libraries: [],
        TemplateExternalServerOrigin: {},
        
        IsSupportingCORS: 'withCredentials' in new XMLHttpRequest(),

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Base methods for managing and orchestrating xTags app
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        MakeTemplateNode: function (defaultData, xmlNode, mainTag, parentTag, rootTag, isTemplate) {
            if (xmlNode.nodeType === 1 && xTags.Templates[xmlNode.tagName] && !isTemplate) {
                var templateNode = xTags.GetTemplateNode(xmlNode.tagName, xmlNode.getAttribute("version"));

                // Check if the node is lazy-loaded from a distant xml
                if (templateNode.getAttribute("src")) {
                    // Create a loader template
                    var tag = xTags.MakeTemplateNode(null, xTags.GetTemplateNodeOrDefault(templateNode, "xLoader"), mainTag, parentTag, rootTag);
                    // Resolve src attribute dependencies
                    var templatetag = xTags.MakeTemplateNode(null, templateNode, null, null, null, true);
                    var remoteUri = templatetag.Attributes.src;

                    // Delay load now
                    $.ajax(xTags.GetCorrectUri(remoteUri, templatetag, "xml"), {
                        cache: false,
                        dataType: xTags.GetCorrectType(remoteUri, templatetag),
                        timeout: 600000,
                        success: $.proxy(function (txt) {
                            if (!xTags.IsUriAllowed(remoteUri)) {
                                // Show the UI here that unsafe code has been blocked.
                                var allowanceEntry = xTags.GetUriEntry(remoteUri);
                                if (!allowanceEntry.deny) {
                                    // The user should choose
                                    var ntag = xTags.MakeTemplateNode({
                                        Data: {
                                            URI: remoteUri
                                        }
                                    }, xTags.GetTemplateNodeOrDefault(null, "xDomainNotAllowed"), null, null, rootTag);
                                    tag.Switch(ntag);
                                }
                                else {
                                    // We may want to change settings
                                    var ntag = xTags.MakeTemplateNode(null, xTags.GetTemplateNodeOrDefault(null, "xDomainManagement"), null, null, rootTag);
                                    tag.Switch(ntag);
                                }
                                return;
                            }

                            // Analyse the text carefully
                            xTags.AnalyseText(txt, false);
                            var templateNode = xTags.GetTemplateNode(xmlNode.tagName, xmlNode.getAttribute("version"));

                            if (templateNode.getAttribute("src")) {
                                // Not found / xLoaderFail
                                var ntag = xTags.MakeTemplateNode(null, xTags.GetTemplateNodeOrDefault(templateNode, "xLoaderFail"), null, null, rootTag);
                                tag.Switch(ntag);
                                return;
                            }

                            // Now remove the old one and add the new one
                            var ntag = xTags.MakeTemplateNode(defaultData, templateNode, null, parentTag, rootTag);
                            xTags._setChildrenNamedTags(ntag, xmlNode, mainTag, rootTag);
                            tag.Switch(ntag);
                        }, this),
                        error: $.proxy(function (jqXHR, textStatus, errorThrown) {
                            // Remove the old one
                            try {
                                var templateNode = xTags.GetTemplateNode(xmlNode.tagName);
                                var ntag = null;
                                if (jqXHR.status < 100) {
                                    // Application is offline
                                    var ntag = xTags.MakeTemplateNode(null, xTags.GetTemplateNodeOrDefault(templateNode, "xOffline"), null, null, rootTag);
                                }
                                else {
                                    // Error / xError
                                    var ntag = xTags.MakeTemplateNode(null, xTags.GetTemplateNodeOrDefault(templateNode, "xError"), null, null, rootTag);
                                }
                                tag.Switch(ntag);

                                // If there is a name just use it to put the content
                                if (ntag.NamedTagsNames.length > 0)
                                    $(ntag[ntag.NamedTagsNames[0]].Element).html("Server response " + jqXHR.status + ": " + errorThrown);
                            }
                            catch (e) {
                                alert(errorThrown + " (also error on " + templateNode.getAttribute("xError") + ": " + e + ")");
                            }
                        }, this)
                    });

                    return tag;
                }

                var cTag = xTags.MakeTemplateNode(defaultData, templateNode, null, parentTag, rootTag, true);
                xTags._setChildrenNamedTags(cTag, xmlNode, mainTag, rootTag);
                return cTag;
            }
            else if (xmlNode.nodeType === 1 && xmlNode.tagName === "phrase") {
                if (parentTag.Children.length === 0 || parentTag.Children[parentTag.Children.length - 1].TagName !== "#text") {
                    // Translations
                    if (xmlNode.firstChild !== null) {
                        var tag = new xTag();
                        tag.TagName = "#text";
                        tag.ParentTag = parentTag;
                        tag.PhraseLibrary = xmlNode.getAttribute("src");
                        tag.PhraseId = xmlNode.getAttribute("id");
                        tag.Text = xmlNode.firstChild.nodeValue;
                        tag.DefaultText = xmlNode.firstChild.nodeValue;
                        return tag;
                    }
                }
                else {
                    parentTag.Children[parentTag.Children.length - 1].PhraseLibrary = xmlNode.getAttribute("src");
                    parentTag.Children[parentTag.Children.length - 1].PhraseId = xmlNode.getAttribute("id");
                    parentTag.Children[parentTag.Children.length - 1].Text += xmlNode.firstChild.nodeValue;
                    parentTag.Children[parentTag.Children.length - 1].DefaultText += xmlNode.firstChild.nodeValue;
                }
            }
            else if (xmlNode.nodeType === 1 && xmlNode.tagName === "data") {
                if (xTags._isOkToRender(xmlNode, parentTag.Version)) {

                    var dataNode = xmlNode.firstChild;
                    while (dataNode && dataNode.nodeType !== 4) { dataNode = dataNode.nextSibling; };
                    if (xmlNode.getAttribute("type") === "text/attribute" && dataNode) {
                        xTags._setAttribute(parentTag, xmlNode.getAttribute("name").toLowerCase(), dataNode.nodeValue);
                    }
                    else if (xmlNode.getAttribute("type") === "text/name-value") {
                        if (xmlNode.getAttribute("src")) {
                            parentTag.IncrementCounter();
                            // If src is specified the ajax get the resource and set it
                            $.ajax(xTags.GetCorrectUri(remoteUri, parentTag, "txt"), {
                                cache: false,
                                dataType: xTags.GetCorrectType(remoteUri, parentTag),
                                timeout: 600000,
                                success: function (txt) {
                                    parentTag.Data[xmlNode.getAttribute("name")] = txt;
                                    parentTag.DefaultData[xmlNode.getAttribute("name")] = txt;

                                    parentTag.DecrementCounter();
                                },
                                error: function () {
                                    // If this fails, set from the datanode values
                                    if (dataNode) {
                                        // Data included
                                        parentTag.Data[xmlNode.getAttribute("name")] = dataNode.nodeValue;
                                        parentTag.DefaultData[xmlNode.getAttribute("name")] = dataNode.nodeValue;
                                    }

                                    parentTag.DecrementCounter();
                                }
                            });
                        }
                        else {
                            // Data included
                            parentTag.Data[xmlNode.getAttribute("name")] = dataNode ? dataNode.nodeValue : null;
                            parentTag.DefaultData[xmlNode.getAttribute("name")] = dataNode ? dataNode.nodeValue : null;
                        }
                    }
                    else if (xmlNode.getAttribute("type") === "text/javascript-events") {
                        if (!xTags.TemplateExternalServerOrigin[parentTag.RootTag.xTemplate]) {
                            if (xmlNode.getAttribute("src")) {
                                parentTag.IncrementCounter();

                                var remoteUri = xmlNode.getAttribute("src");
                                $.ajax(xTags.GetCorrectUri(remoteUri, parentTag, "txt"), {
                                    cache: false,
                                    dataType: xTags.GetCorrectType(remoteUri, parentTag),
                                    timeout: 600000,
                                    success: function (txt) {
                                        if (!txt.match(/^\s*$/gi))
                                            parentTag.Events = xTags.EvaluateEventsStructure(txt);
                                        parentTag.DecrementCounter();
                                    },
                                    error: function () {
                                        parentTag.DecrementCounter();
                                    }
                                });
                            }
                            else if (dataNode) {
                                parentTag.Events = xTags.EvaluateEventsStructure(dataNode.nodeValue);
                            }
                        }
                    }
                    else if (xmlNode.getAttribute("type") === "text/javascript") {
                        // Check if this is an external resource
                        if (!xTags.TemplateExternalServerOrigin[parentTag.RootTag.xTemplate]) {
                            if (xmlNode.getAttribute("src")) {
                                if (!$("head script[src='" + xmlNode.getAttribute("src") + "']").length) {
                                    parentTag.IncrementCounter();
                                    var script = document.createElement("script");
                                    script.type = "text/javascript";
                                    if (script.readyState) {
                                        script.onreadystatechange = function () {
                                            if (script.readyState == "loaded" || script.readyState == "complete") {
                                                script.onreadystatechange = null;
                                                parentTag.DecrementCounter();
                                            };
                                        };
                                    } else {
                                        script.onload = function () {
                                            parentTag.DecrementCounter();
                                        };
                                    };
                                    script.src = xmlNode.getAttribute("src");
                                    document.getElementsByTagName("head")[0].appendChild(script);
                                }
                            }
                            else if (dataNode) {
                                $('body').append("<script type='text/javascript'>\n" + dataNode.nodeValue + "</script>");
                            }
                        }
                    }
                    else if (xmlNode.getAttribute("type") === "text/css") {
                        // Check if this is an external resource
                        if (xmlNode.getAttribute("src")) {
                            if (!$("head link[href='" + xmlNode.getAttribute("src") + "']").length)
                                $('head').append("<link rel='stylesheet' type='text/css' href='" + xmlNode.getAttribute("src") + "' />");
                        }
                        else if (dataNode) {
                            $('body').append("<style type='text/css'>\n" + dataNode.nodeValue + "</style>");
                        }
                    }
                    else if (xmlNode.getAttribute("type") === "text/plain" && dataNode) {
                        // Plain text (no html)
                        var tag = new xTag();
                        tag.TagName = "#text";
                        tag.ParentTag = parentTag;
                        tag.Text = dataNode.nodeValue;
                        tag.DefaultText = dataNode.nodeValue;
                        return tag;
                    }
                    else if (xTags.Events.OnCustomData) {
                        xTags.Events.OnCustomData(parentTag, xmlNode, dataNode);
                    }
                }
            }
            else if (xmlNode.nodeType === 1 && xmlNode.tagName.toLowerCase() === "script") {
                // Script tags are not allowed
            }
            else if (xmlNode.nodeType === 1 && xmlNode.tagName.toLowerCase() === "iframe") {
                // iframe tags are not allowed
            }
            else if (xmlNode.nodeType === 1) {
                if (xTags._isOkToRenderNode(xmlNode, parentTag, mainTag)) {
                    var tag = new xTag(defaultData);
                    tag.TagName = xmlNode.tagName.toLowerCase();
                    tag.ParentTag = parentTag;

                    if (!mainTag) {
                        tag.TagName = "div";
                        tag.xTemplate = xmlNode.tagName;
                        mainTag = tag;
                    }
                    else
                        tag.MainTag = mainTag;

                    if (rootTag)
                        tag.RootTag = rootTag;
                    else
                        tag.RootTag = rootTag = tag;

                    if (xmlNode.getAttribute("name")) {
                        var name = xmlNode.getAttribute("name");
                        if (!mainTag.hasOwnProperty(name)) {
                            mainTag.NamedTagsNames[mainTag.NamedTagsNames.length] = name;
                            mainTag[name] = tag;
                        }
                        else throw new Error("Name '" + name + "' exists as an object on template '" + mainTag.xTemplate + "'. Choose something else.");
                    }

                    tag.XmlNode = xmlNode;

                    // Now gather the attribute nodes
                    xTags._setAttributes(tag, xmlNode);

                    // Fix-me: Forms have different handling when are server elements

                    if (!tag.DataSource) {
                        for (var i = 0; i < xmlNode.childNodes.length; ++i) {
                            // When the tag is not another template or just text
                            var cTag = xTags.MakeTemplateNode(null, xmlNode.childNodes[i], mainTag, tag, rootTag);
                            if (cTag) {
                                if (tag.Text)
                                    throw new Error("This element has both children and text; this is not allowed. Template: '" + mainTag.xTemplate + "'");
                                tag.Children[tag.Children.length] = cTag;
                            }
                        }
                    }

                    return tag;
                }
            }
            else if (xmlNode.nodeType === 3 || xmlNode.nodeType === 4) {
                if (parentTag.Children.length === 0 || parentTag.Children[parentTag.Children.length - 1].TagName !== "#text") {
                    var tag = new xTag();
                    tag.TagName = "#text";
                    tag.ParentTag = parentTag;
                    tag.Text = xmlNode.nodeValue;
                    tag.DefaultText = xmlNode.nodeValue;
                    return tag;
                }
                else {
                    parentTag.Children[parentTag.Children.length - 1].Text += xmlNode.nodeValue;
                    parentTag.Children[parentTag.Children.length - 1].DefaultText += xmlNode.nodeValue;
                }
            }

            return null;
        },

        _isOkToRenderNode: function (xmlNode, parentTag, mainTag) {
            var version = null;

            if (mainTag)
                version = mainTag.Version;

            if (!version && parentTag)
                version = parentTag.Version;

            return this._isOkToRender(xmlNode, version);
        },

        _isOkToRender: function (xmlNode, version) {
            return (!xmlNode.getAttribute("domain") || xmlNode.getAttribute("domain") === window.location.hostname)
                && (!xmlNode.getAttribute("port") || xmlNode.getAttribute("port") === window.location.port)
                && (!version || !xmlNode.getAttribute("version") || xmlNode.getAttribute("version") === version);
        },

        _htmlEncode: function (str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        _setAttributes: function (tag, xmlNode) {
            for (var i = 0; i < xmlNode.attributes.length; ++i) {
                var lAttrName = xmlNode.attributes[i].name.toLowerCase();
                xTags._setAttribute(tag, lAttrName, xmlNode.attributes[i].value);
            }
        },

        _setAttribute: function (tag, lAttrName, value) {
            if (lAttrName === "mode") {
                if (value.toLowerCase() === "server")
                    tag.Mode = xTags.Mode.Server;
                else if (value.toLowerCase() === "browser")
                    tag.Mode = xTags.Mode.Browser;
            }
            else if (lAttrName === "id") {
                tag.Id =
                    tag.Attributes[lAttrName] =
                        tag.DefaultAttributes[lAttrName] = value;
            }
            else if (lAttrName === "serverorigin") {
                tag.ServerOrigin = value;
            }
            else if (lAttrName === "apikey") {
                tag.ApiKey = value;
            }
            else if (lAttrName === "version") {
                tag.Version = value;
            }
            else if (lAttrName === "datasource") {
                tag.DataSource = value;
            }
            else if (lAttrName === "modetype") {
                tag.ModeType = value;
            }
            else if (lAttrName === "tag") {
                tag.TagName = value;
            }
            else if (lAttrName === "lcid") {
                tag.LCID = parseInt(value);
                if (isNaN(tag.LCID)) tag.LCID = -1;
            }
            else if (lAttrName === "href" && value.match(/javascript:/i)) {
                tag.Attributes[lAttrName] = "javascript:void(0)";
                tag.DefaultAttributes[lAttrName] = "javascript:void(0)";
            }
            else {
                tag.Attributes[lAttrName] = value;
                tag.DefaultAttributes[lAttrName] = value;
            }
        },

        _setChildrenNamedTags: function (cTag, xmlNode, mainTag, rootTag) {
            cTag.MainTag = mainTag;

            if (mainTag) {
                if (xmlNode.getAttribute("name")) {
                    var name = xmlNode.getAttribute("name");
                    if (!mainTag.hasOwnProperty(name)) {
                        mainTag.NamedTagsNames[mainTag.NamedTagsNames.length] = name;
                        mainTag[name] = cTag;
                    }
                    else throw new Error("Name '" + name + "' exists as a property on template '" + mainTag.xTemplate + "'. Choose something else.");
                }

                xTags._setAttributes(cTag, xmlNode);
            }

            cTag.XmlNode = xmlNode;

            var templateChildren = xmlNode.childNodes;
            // Check for namings that need to be set as children in named tags
            for (var j = 0; j < templateChildren.length; ++j) {
                if (cTag[templateChildren[j].tagName]) {
                    // Now gather the attribute nodes
                    xTags._setAttributes(cTag[templateChildren[j].tagName], templateChildren[j]);
                    cTag[templateChildren[j].tagName].XmlNode = templateChildren[j];

                    // Set up further naming on child named tags
                    if (mainTag && templateChildren[j].getAttribute("name")) {
                        var name = templateChildren[j].getAttribute("name");
                        if (!mainTag.hasOwnProperty(name)) {
                            mainTag.NamedTagsNames[mainTag.NamedTagsNames.length] = name;
                            mainTag[name] = cTag[templateChildren[j].tagName];
                        }
                        else throw new Error("Name '" + name + "' exists as a property on template '" + mainTag.xTemplate + "'. Choose something else.");
                    }

                    // Now add the child nodes
                    if (templateChildren[j].childNodes.length > 0) {
                        cTag[templateChildren[j].tagName].Children = [];
                        for (var k = 0; k < templateChildren[j].childNodes.length; ++k) {
                            var ccTag = xTags.MakeTemplateNode(null, templateChildren[j].childNodes[k], mainTag, cTag[templateChildren[j].tagName], rootTag);
                            if (ccTag)
                                cTag[templateChildren[j].tagName].Children.push(ccTag);
                        }
                    }
                }
                else if (mainTag != null && templateChildren[j].tagName == "data") {
                    xTags.MakeTemplateNode(null, templateChildren[j], mainTag, cTag, rootTag);
                }
            }
        },

        EvaluateEventsStructure: function (txt) {
            return eval("(function() { var a = " + txt + "; return a;})()");
        },

        GetTemplateNode: function (name, version) {
            if (version && xTags.Templates[name + version])
                return xTags.Templates[name + version];

            // String with version: e.g. "Namespace.Template v1.01"
            if (/[^ ]+ v.+/g.test(name)) {
                var _match = name.match(/([^ ]+) v(.+)/);
                var _name = _match[1];
                var _version = _match[2];

                if (version && xTags.Templates[_name + _version])
                    return xTags.Templates[_name + _version];
                name = _name;
            }

            return xTags.Templates[name];
        },

        GetTemplateNodeOrDefault: function (xmlNode, attributeName) {
            if (!xmlNode || !xmlNode.getAttribute(attributeName))
                return xTags.Templates["xTags.DefaultTemplates." + attributeName];
            var tnode = xTags.GetTemplateNode(xmlNode.getAttribute(attributeName));
            if (!tnode)
                return xTags.Templates["xTags.DefaultTemplates." + attributeName];
            return tnode;
        },

        GetPhrase: function (id, lcid) {
            var phrase = null;
            for (var i = 0; i < xTags.Libraries.length; ++i) {
                phrase = xTags.Libraries[i].selectSingleNode("//phrase[@id='" + id + "']/lang[@lcid='" + lcid + "']");
                if (phrase)
                    return phrase.firstChild.nodeValue;
            }
            return null;
        },

        GetAllEntries: function () {
            if (window.localStorage) {
                var entries = [];
                var jsonEntries = window.localStorage.getItem("xTags.UrisAllowed");
                if (jsonEntries) {
                    entries = $.parseJSON(jsonEntries);
                }
                
                return entries;
            }

            return [];
        },

        RemoveUriEntry: function (uri) {
            uri = uri.toLowerCase();

            if (uri.indexOf("http://") < 0 &&
                uri.indexOf("/") == 0)
                return { allow: true }; // Local is allowed

            if (uri.indexOf("http://xtags.msd.am/") === 0)
                return { allow: true }; // xTags home is always allowed

            if (window.localStorage) {
                var entries = xTags.GetAllEntries();
                for (var i = 0; i < entries.length; ++i)
                    if (entries[i].uri === uri) {
                        entries.splice(i, 1);
                        --i;
                    }

                window.localStorage.setItem("xTags.UrisAllowed", JSON.stringify(entries));
            }

            return;
        },

        GetUriEntry: function (uri) {
            uri = uri.toLowerCase();

            if (uri.indexOf("http://") < 0 &&
                uri.indexOf("/") == 0)
                return { allow: true }; // Local is allowed

            if (uri.indexOf("http://xtags.msd.am/") === 0)
                return { allow: true }; // xTags home is always allowed

            if (window.localStorage) {
                var entries = xTags.GetAllEntries();
                for (var i = 0; i < entries.length; ++i)
                    if (entries[i].uri === uri)
                        return { allow: entries[i].allow, deny: entries[i].deny };
            }

            return { allow: false, deny: false };
        },

        IsUriAllowed: function (uri) {
            var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
            thisUri = thisUri.toLowerCase();
            uri = uri.toLowerCase();

            if ((uri.indexOf("http://") < 0 &&
                uri.indexOf("/") == 0) || uri.indexOf(thisUri) == 0)
                return true; // Local is allowed

            if (uri.indexOf("http://xtags.msd.am/") == 0)
                return true; // xTags home is always allowed

            if (window.localStorage) {
                var entries = xTags.GetAllEntries();
                for (var i = 0; i < entries.length; ++i)
                    if (entries[i].uri === uri)
                        return entries[i].allow && !entries[i].deny;
            }

            return false;
        },

        AllowUri: function (uri) {
            if (window.localStorage) {
                var entries = xTags.GetAllEntries();
                var item = -1;
                for (var i = 0; i < entries.length; ++i)
                    if (entries[i].uri === uri.toLowerCase())
                        item = i;
                if (item < 0) {
                    item = entries.length;
                    entries[entries.length] = { uri: uri.toLowerCase() };
                }
                entries[item].allow = true;
                entries[item].deny = false;

                window.localStorage.setItem("xTags.UrisAllowed", JSON.stringify(entries));
            }
        },

        DenyUri: function (uri) {
            if (window.localStorage) {
                var entries = xTags.GetAllEntries();
                var item = -1;
                for (var i = 0; i < entries.length; ++i)
                    if (entries[i].uri === uri.toLowerCase())
                        item = i;
                if (item < 0) {
                    item = entries.length;
                    entries[entries.length] = { uri: uri.toLowerCase() };
                }
                entries[item].allow = false;
                entries[item].deny = true;

                window.localStorage.setItem("xTags.UrisAllowed", JSON.stringify(entries));
            }
        },

        //GetCorrectUri: function (uri, xTag, type) {
        //    var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
        //    var thisUriPath = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + window.location.pathname;
        //    if (!uri)
        //        uri = thisUriPath;

        //    if (/*xTags.IsSupportingCORS || */uri.indexOf("http://") !== 0 || uri.indexOf(thisUri) === 0)
        //        return uri;
        //    else if (xTag && xTag.ServerOrigin && xTag.ServerOrigin.indexOf(thisUri) !== 0)
        //        return xTag.ServerOrigin + "?xtags-jsonp" + (type ? "-" + type : "") + "=" + encodeURIComponent(uri);
        //    else
        //        return thisUriPath + "?xtags-jsonp" + (type ? "-" + type : "") + "=" + encodeURIComponent(uri);
        //},

        //GetCorrectRestUri: function (uri, xTag) {
        //    var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
        //    var thisUriPath = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + window.location.pathname;
        //    if (!uri)
        //        uri = thisUriPath;

        //    if (uri.indexOf("http://") !== 0 || uri.indexOf(thisUri) === 0)
        //        return uri;
        //    else if (xTag && xTag.ServerOrigin && xTag.ServerOrigin.indexOf(thisUri) !== 0)
        //        return xTag.ServerOrigin;
        //    else
        //        throw new Error("Cannot find the server URI. Either set the ServerOrigin or use a local URI");
        //},
        
        GetCorrectUri: function (uri, xTag, type) {
            var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
            var thisUriPath = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + window.location.pathname;
            if (!uri)
                uri = thisUriPath;

            if (uri.indexOf("~/") === 0) {
                uri = uri.replace("~/", "/");
            }

            // The uri is local, so we can get it directly with xhr
            if (/*xTags.IsSupportingCORS || */uri.indexOf("http://") !== 0 || uri.indexOf(thisUri) === 0)
                return uri;
            // The uri is remote, so we must use the server origin if there to do a jsonp
            else if (xTag && xTag.ServerOrigin)
                return xTag.ServerOrigin + "?xtags-jsonp" + (type ? "-" + type : "") + "=" + encodeURIComponent(uri);
            // The server oring is not available, so call the page we are on with jsonp
            else 
                return thisUriPath + "?xtags-jsonp" + (type ? "-" + type : "") + "=" + encodeURIComponent(uri);
        },

        GetCorrectRestUri: function (uri, xTag) {
            var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
            var thisUriPath = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + window.location.pathname;
            if (!uri)
                uri = thisUriPath;

            if (uri.indexOf("~/") === 0) {
                uri = uri.replace("~/", "/");
            }

            // The uri is local, so we can get it directly with xhr
            if (uri.indexOf("http://") !== 0 || uri.indexOf(thisUri) === 0)
                return uri;
            // The uri is remote, so we must use the server origin if there to do a jsonp
            else if (xTag && xTag.ServerOrigin)
                return xTag.ServerOrigin;
            else 
                throw new Error("Cannot find the server URI. Either set the ServerOrigin or use a local URI");
        },

        GetCorrectType: function (uri, xTag) {
            var thisUri = window.location.protocol + "//" + window.location.hostname + (window.location.port && window.location.port !== "80" ? ":" + window.location.port : "") + "/";
            if (/*xTags.IsSupportingCORS || */!uri || uri.indexOf("http://") !== 0 || uri.indexOf(thisUri) === 0)
                return "text";
            else
                return "jsonp";
        },

        TravelProperties: function (obj, propertiesPath) {
            var values;
            if (propertiesPath.indexOf('.') > -1)
                values = propertiesPath.split('.');
            else
                values = [propertiesPath];
            for (var j = 0; j < values.length; ++j) {
                if (!obj[values[j]])
                    return null;
                obj = obj[values[j]];
            }

            return obj;
        },

        InstantiateFromXmlText: function (xmlText, defaultData) {
            // Create a new element from xml, without registering template
            var xmlObj = xTags.BuildXMLFromString(xmlText);
            var templateNode = xmlObj.documentElement;
            return xTags.MakeTemplateNode(defaultData, templateNode);
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // General methods for xTags templates
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        AnalyseText: function (xmlText, unsafe) {
            var xmlObj = xTags.BuildXMLFromString(xmlText);
            var ns = xmlObj.documentElement.getAttribute("namespace");
            if (!ns) ns = '';
            else ns += ".";
            var templateNodes = xmlObj.selectNodes("/*/*");
            xTags.Libraries[xTags.Libraries.length] = xmlObj;

            for (var i = 0; i < templateNodes.length; ++i) {
                var templateNode = templateNodes[i];
                var name = ns + templateNode.tagName;

                if (name !== "data" && name !== "phrase" && !templateNode.getAttribute("notTemplate")) {
                    if (!xTags.Templates[name] || !(!xTags.Templates[name].getAttribute("src") && templateNode.getAttribute("src"))) {
                        // The library that is included
                        xTags.Templates[name] = templateNode;
                        if (templateNode.getAttribute("version"))
                            xTags.Templates[name + templateNode.getAttribute("version")] = templateNode;

                        if (unsafe)
                            this.TemplateExternalServerOrigin[name] = true; // Do not make mistakes here

                        var values;
                        var obj = window;
                        if (name.indexOf('.') > -1)
                            values = name.split('.');
                        else
                            values = [name];
                        for (var j = 0; j < values.length - 1; ++j) {
                            if (!obj[values[j]])
                                obj[values[j]] = {};
                            obj = obj[values[j]];
                        }

                        // Create the class
                        obj[values[values.length - 1]] = function (defaultData, version) {
                            var templateNode = xTags.GetTemplateNode(this.TemplateName, version);

                            // Create an instance from template
                            return xTags.MakeTemplateNode(defaultData, templateNode);
                        };

                        obj[values[values.length - 1]].prototype.TemplateName = name;
                    }
                }
            }
        },

        CreateInstance: function (templateName, defaultData, version) {
            var templateNode = xTags.GetTemplateNode(templateName, version);
            // Create an instance from template
            return xTags.MakeTemplateNode(defaultData, templateNode);
        },

        Import: function (templateName, library, optionalServerOrigin) {
            // Add it to the registration DB
            xTags.AnalyseText(
                "<xml><" + templateName + " src=\"" + library + "\"" + (optionalServerOrigin ? " ServerOrigin=\"" + optionalServerOrigin + "\"" : "") + " /></xml>"
            );
        },
        
        SetJQ: function(jQuery) {
            if (typeof($) == "undefined" && typeof(jQuery) !== "undefined")
                $ = jQuery;
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Server side attach methods
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        _a: function (id) {
            if (!id || typeof (id) != "string")
                return null;

            var xtag = xTags.All[id];
            for (var i = 1; i < arguments.length; ++i) {
                xtag = xtag.Children[arguments[i]];
            }

            return xtag ? xtag : null;
        },

        _b: function (root, main, xt, id) {
            var xtag = xTags.All[id];
            var el = document.getElementById(id);

            if (!xtag && arguments.length == 4) {
                xtag = new xTag();
                xtag.xTemplate = xt;
                xTags.All[id] = xtag;
                if (xtag.xTemplate)
                    xtag.XmlNode = xTags.GetTemplateNode(xtag.xTemplate);
            }

            for (var i = 4; i < arguments.length; ++i) {
                el = el.childNodes[arguments[i]];

                if (!xtag.Children[arguments[i]]) {
                    var cxtag = new xTag();
                    cxtag.ParentTag = xtag;

                    if (!cxtag.RootTag)
                        cxtag.RootTag = xtag.RootTag ? xtag.RootTag : xtag;
                    if (!cxtag.MainTag)
                        cxtag.MainTag = xtag.xTemplate ? xtag : xtag.MainTag ? xtag.MainTag : xtag;

                    if (!cxtag.xTemplate) {
                        if (cxtag.RootTag && xtag.XmlNode && xtag.XmlNode.childNodes.length) {
                            for (var position = arguments[i], j = 0, dataNodes = 0; position > -1; ++j) {
                                if (j >= xtag.XmlNode.childNodes.length) {
                                    j = 0; dataNodes = 0;
                                }

                                if (xtag.XmlNode.childNodes[j].nodeType === 1 &&
                                    xtag.XmlNode.childNodes[j].tagName !== "data") {
                                    if (position == 0) {
                                        cxtag.XmlNode = xtag.XmlNode.childNodes[j];
                                        break;
                                    }
                                    --position;
                                }
                                else ++dataNodes;

                                if (dataNodes == xtag.XmlNode.childNodes.length)
                                    break;
                            }
                        }
                    }
                    else {
                        cxtag.XmlNode = xTags.GetTemplateNode(cxtag.xTemplate);
                    }

                    xtag.Children[arguments[i]] = cxtag;
                }

                xtag = xtag.Children[arguments[i]];
            }

            xtag.Element = el;
            xtag.xTemplate = xt;

            if (root)
                xtag.RootTag = xTags._a.apply(this, root);
            if (main)
                xtag.MainTag = xTags._a.apply(this, main);

            if (xtag.xTemplate)
                xtag.XmlNode = xTags.GetTemplateNode(xtag.xTemplate);

            return xtag;
        },

        _c: function (root, main, xtag, parentIndex) {
            if (xtag.xTemplate && !xtag.XmlNode)
                xtag.XmlNode = xTags.GetTemplateNode(xtag.xTemplate);

            if (!xtag.Children[parentIndex]) {
                xtag.Children[parentIndex] = new xTag();
                xtag.Children[parentIndex].ParentTag = xtag;

                if (root) {
                    for (var position = parentIndex, j = 0; position > -1; ++j) {
                        if (j == xtag.XmlNode.childNodes.length)
                            j = 0;

                        if (xtag.XmlNode.childNodes[j].nodeType === 1 &&
                            xtag.XmlNode.childNodes[j].tagName !== "data") {
                            if (position == 0) {
                                xtag.Children[parentIndex].XmlNode = xtag.XmlNode.childNodes[j];
                                break;
                            }
                            --position;
                        }
                    }
                }
            }

            xtag = xtag.Children[parentIndex];

            if (root)
                xtag.RootTag = xTags._a.apply(this, root);
            if (main)
                xtag.MainTag = xTags._a.apply(this, main);

            if (xtag.xTemplate)
                xtag.XmlNode = xTags.GetTemplateNode(xtag.xTemplate);

            return xtag;
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Observable MVVM methods
        ///////////////////////////////////////////////////////////////////////////////////////////////////////

        Observable: function (obj) {
            if (obj === null || typeof (obj) === "undefined") return null;
            if (obj._IsObservable || typeof (obj) !== "object" || typeof (obj.selectNodes) === "function") return obj;

            var obs = {
                _data: {}, _subscribers: { "this": {} }, _IsObservable: true
            };

            if (typeof (obj.length) === "number" && typeof (obj) === "object") {
                obs = [];
                obs._subscribers = { "this": {} };
                obs._IsObservable = true;
                for (var i = 0; i < obj.length; ++i) {
                    obs.push(xTags.Observable(obj[i]));
                }

                var commonMethods = ["pop", "push", "splice"];
                for (var i = 0; i < commonMethods.length; ++i) {
                    obs[commonMethods[i]] = (function () {
                        var oldMethod = obs[commonMethods[i]];
                        var parentObject = obs;
                        return function () {
                            oldMethod.apply(parentObject, arguments);
                            if (parentObject._subscribers["this"])
                                for (var prop in parentObject._subscribers["this"])
                                    if (typeof (parentObject._subscribers["this"][prop]) === "function")
                                        parentObject._subscribers["this"][prop](parentObject);
                        };
                    })();
                }
            }
            else for (var prop in obj) {
                if (typeof (obj[prop]) !== "function") {
                    if (typeof (obj[prop]) === "object") {
                        if (obj[prop] !== null && typeof (obj[prop].length) === "number") {
                            obs._data[prop] = [];
                            for (var i = 0; i < obj[prop].length; ++i) {
                                obs._data[prop].push(xTags.Observable(obj[prop][i]));
                            }

                            var commonMethods = ["pop", "push", "splice"];
                            for (var i = 0; i < commonMethods.length; ++i) {
                                obs._data[prop][commonMethods[i]] = (function () {
                                    var oldMethod = obs._data[prop][commonMethods[i]];
                                    var parentObject = obs;
                                    var lprop = prop;
                                    return function () {
                                        oldMethod.apply(parentObject._data[lprop], arguments);
                                        if (parentObject._subscribers[lprop])
                                            for (var prop in parentObject._subscribers[lprop])
                                                if (typeof (parentObject._subscribers[lprop][prop]) === "function")
                                                    parentObject._subscribers[lprop][prop](parentObject);
                                    };
                                })();
                            }
                        }
                        else {
                            var o = xTags.Observable(obj[prop]);
                            if (typeof (o) !== "undefined") obs._data[prop] = o;
                        }
                    }
                    else obs._data[prop] = obj[prop];

                    obs[prop] = (function () {
                        var lprop = prop;
                        var _this = obs;
                        return function (value) {
                            if (typeof (value) === "undefined") {
                                // Getter
                                return this._data[lprop];
                            }
                            else {
                                // Setter - invoke subscriptions
                                this._data[lprop] = xTags.Observable(value);

                                if (this._subscribers[lprop])
                                    for (var prop in this._subscribers[lprop])
                                        if (typeof (this._subscribers[lprop][prop]) === "function")
                                            this._subscribers[lprop][prop](_this);
                            }
                        };
                    } ());

                    obs[prop].ParentObject = obs;
                }
                else {
                    obs[prop] = obj[prop];
                }
            }

            // Subscribe methods   
            obs.Subscribe = function (propName, property, attribute, datavalue, xtag) {
                if (!propName)
                    propName = "this";

                var id = xtag.GetId() + "-" +
                    propName +
                    (property ? property : "") +
                    (attribute ? attribute : "") +
                    (datavalue ? datavalue : "");

                if (!this._subscribers[propName])
                    this._subscribers[propName] = {};

                if (!property && !attribute && !datavalue) {
                    this._subscribers[propName][id] = (function (newValue) {
                        xtag.RebindStructure(newValue);
                    });
                    return;
                }

                if (property) {
                    this._subscribers[propName][id] = (function (newValue) {
                        xtag.RebindProperty(property, newValue);
                    });
                }
                if (attribute) {
                    this._subscribers[propName][id] = (function (newValue) {
                        xtag.RebindAttribute(attribute, newValue);
                    });
                }
                if (datavalue) {
                    this._subscribers[propName][id] = (function (newValue) {
                        xtag.RebindDataValue(datavalue, newValue);
                    });
                }
            };
            obs.Unsubscribe = function (propName, property, attribute, datavalue, xtag) {
            };
            return obs;
        },

        TravelObservableProperties: function (obj, propertiesPath) {
            var values;
            if (propertiesPath.indexOf('.') > -1)
                values = propertiesPath.split('.');
            else
                values = [propertiesPath];
            for (var j = 0; j < values.length - 1; ++j) {
                if (typeof (obj[values[j]]) !== "function")
                    return null;
                obj = obj[values[j]](); // A function call for get
            }

            return obj;
        },

        bindingRE: /#\{([^\{\}]*?)\}/,
        propertiesRE: /this(\.([a-zA-Z0-9\.]+)\(\)|\[['"]([a-zA-Z0-9\.]+)['"]\](\(\))?)/,

        ReplaceBindings: function (value, obj, xtag, property, attribute, datavalue) {
            var matches = value.match(xTags.bindingRE);
            var newValue = value;
            while (matches) {
                if (obj) {
                    var lobj = obj;
                    var propsMatch = matches[1];
                    var props = propsMatch.match(xTags.propertiesRE);
                        
                    while (props) {
                        var p = (props[2] || props[3]);

                        if (lobj.selectNodes) {
                            var allTxt = "";
                            if (p == "Text") {
                                var txt = "";
                                for (var i = 0; i < lobj.childNodes.length; ++i) {
                                    if (lobj.childNodes[i].nodeType == 3) {
                                        txt += lobj.childNodes[i].nodeValue;
                                    }
                                }
                                allTxt = txt;
                            }
                            else if (lobj.attributes && lobj.attributes.getNamedItem(p)) {
                                allTxt = lobj.getAttribute(p);
                            }
                            else if (lobj.selectSingleNode(p)) {
                                var node = lobj.selectSingleNode(p);
                                var txt = "";
                                for (var i = 0; i < node.childNodes.length; ++i) {
                                    if (node.childNodes[i].nodeType == 3) {
                                        txt += node.childNodes[i].nodeValue;
                                    }
                                }
                                allTxt = txt;
                            }

                            lobj[p] = function() {
                                var val = allTxt;
                                return function() {
                                    return val;
                                };
                            }();
                        } else {
                            // Subscribe to change events
                            var observable = xTags.TravelObservableProperties(lobj, p);
                            observable.Subscribe(p, property, attribute, datavalue, xtag);
                        }
                            
                        // Do again
                        propsMatch = propsMatch.replace(p, "");
                        props = propsMatch.match(xTags.propertiesRE);
                    }

                    try {
                        var dvalue = $.proxy(eval("(function(){ var func = function() { var returned = " + matches[1] + "; return returned;}; return func;})()"), lobj)();
                        newValue = newValue.replace("#{" + matches[1] + "}", dvalue);
                    }
                    catch (e) {
                        newValue = newValue.replace("#{" + matches[1] + "}", e);
                    }
                }
                else {
                    newValue = newValue.replace("#{" + matches[1] + "}", "");
                }

                matches = newValue.match(xTags.bindingRE);
            }

            // The rest that have not been found must be removed
            newValue = newValue.replace(xTags.bindingRE, "");
            return newValue;
        },

        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Cross browser compatibility and base code (changed)
        ///////////////////////////////////////////////////////////////////////////////////////////////////////
        // Start from http://help.dottoro.com/ljcilrao.php
        CreateMSXMLDocumentObject: function () {
            if (ActiveXObject in window) {
                var progIDs = [
                            "Msxml2.DOMDocument.6.0",
                            "Msxml2.DOMDocument.5.0",
                            "Msxml2.DOMDocument.4.0",
                            "Msxml2.DOMDocument.3.0",
                            "MSXML2.DOMDocument",
                            "MSXML.DOMDocument"
                            ];
                for (var i = 0; i < progIDs.length; i++) {
                    try {
                        return new ActiveXObject(progIDs[i]);
                    } catch (e) { };
                }
            }

            try {
                return new ActiveXObject('Microsoft.XMLDOM');
            } catch(e) {
            } 

            return null;
        },

        BuildXMLFromString: function (text) {
            var xmlDoc = null;
            if (window.DOMParser && typeof (XMLDocument.prototype.createNSResolver) !== "undefined") { // all browsers, except IE
                var parser = new DOMParser();
                try {
                    xmlDoc = parser.parseFromString(text, "text/xml");
                } catch (e) {
                    // if text is not well-formed, 
                    // it raises an exception in IE from version 9
                    return null;
                };
            }
            else {  // Internet Explorer before version 9
                xmlDoc = xTags.CreateMSXMLDocumentObject();
                if (!xmlDoc) {
                    return null;
                }

                xmlDoc.loadXML(text);
            }

            if (xmlDoc.parseError && xmlDoc.parseError.errorCode !== 0) {
                return null;
            }
            else {
                if (xmlDoc.documentElement) {
                    if (xmlDoc.documentElement.nodeName === "parsererror") {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }

            return xmlDoc;
        },

        GetStringFromXML: function (xmlDoc) {
            if (window.XMLSerializer) { // all browsers, except IE before version 9
                try {
                    // the serializeToString method raises an exception in IE9
                    var serializer = new XMLSerializer();
                    return serializer.serializeToString(xmlDoc.documentElement);
                }
                catch (e) {
                }
            }

            if ('xml' in xmlDoc) {  // Internet Explorer
                return xmlDoc.xml;
            }

            return null;
        }
        // End from http://help.dottoro.com/ljcilrao.php
    };

    // Fix for selectNode / selectSingleNode
    if (typeof (XMLDocument) !== "undefined" && !XMLDocument.prototype.selectNodes) {
        XMLDocument.prototype.selectNodes = function (cXPathString, xNode) {
            if (!xNode) xNode = this;
            var oNSResolver = this.createNSResolver(this.documentElement);
            var aItems = this.evaluate(cXPathString, xNode, oNSResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            var aResult = [];
            for (var i = 0; i < aItems.snapshotLength; i++)
                aResult[aResult.length] = aItems.snapshotItem(i);
            return aResult;
        };
        XMLDocument.prototype.selectSingleNode = function (cXPathString, xNode) {
            if (!xNode) xNode = this;
            var xItems = this.selectNodes(cXPathString, xNode);
            if (xItems.length > 0) return xItems[0];
            else return null;
        };
    }

    if (typeof (Element) !== "undefined" && !Element.prototype.selectNodes) {
        Element.prototype.selectNodes = function (cXPathString) {
            if (this.ownerDocument.selectNodes)
                return this.ownerDocument.selectNodes(cXPathString, this);
            else throw "For XML Elements Only";
        };
        Element.prototype.selectSingleNode = function (cXPathString) {
            if (this.ownerDocument.selectSingleNode)
                return this.ownerDocument.selectSingleNode(cXPathString, this);
            else throw "For XML Elements Only";
        };
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // Set up the templates
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    (function () {
        // Load standard templates (load, error, etc...) - Always with namespace "xTags.DefaultTemplates."
        xTags.AnalyseText(
        "<xml>" +
            "<xTags.DefaultTemplates.xLoader tag='span' class='info'>" +
                "Loading..." +
            "</xTags.DefaultTemplates.xLoader>" +
            "<xTags.DefaultTemplates.xOffline class='info'>" +
                "Application is offline at the moment and cannot load the requested resource." +
            "</xTags.DefaultTemplates.xOffline>" +
            "<xTags.DefaultTemplates.xLoaderFail class='error'>" +
                "Failed loading this template. Maybe is missing from the library..." +
            "</xTags.DefaultTemplates.xLoaderFail>" +
            "<xTags.DefaultTemplates.xError class='error'>" +
                "An unexpected error has happend: " +
                "<span name='Error'>Not specified.</span>" +
            "</xTags.DefaultTemplates.xError>" +
            "<xTags.DefaultTemplates.xLogin ServerOrigin=\"http://www.msd.am/Apps/Authentication/\" src=\"http://xtags.msd.am/xTags/xTags.DefaultTemplates.xml\" />" +
            "<xTags.DefaultTemplates.xDomainNotAllowed ServerOrigin=\"http://www.msd.am/Apps/Authentication/\" src=\"http://xtags.msd.am/xTags/xTags.DefaultTemplates.xml\" />" +
            "<xTags.DefaultTemplates.xDomainManagement ServerOrigin=\"http://www.msd.am/Apps/Authentication/\" src=\"http://xtags.msd.am/xTags/xTags.DefaultTemplates.xml\" />" +
        "</xml>"
        );
    })();

    ///////////////////////////////////////////////////////////////////////////////////////////////////////
    // JQuery loaded
    ///////////////////////////////////////////////////////////////////////////////////////////////////////

    require("jQuery", function () {
        xTags.SetJQ(window.jQuery);
    });
})();