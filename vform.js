; (function () {
    var vueForm = {};
    vueForm.install = function (Vue, options) {
        var invalidClass = 'v-invalid',
            validClass = 'v-valid',
            dirtyClass = 'v-dirty',
            pristineClass = 'v-pristine',
            submittedClass = 'v-submitted';

	    options = options || {};

        var validation = options.validation || function(name, value, schema) {
                var self = this;

                self.$setPending(true);
                schema.path(name).doValidate(value,  function(err) {
                    self.$setPending(false);
	                self.$setValidity(true);

	                if(err)
	                    self.$setValidity(err.kind, false);
                });
            };

        function setValidity(self, key, isValid) {
            if (typeof key === 'boolean') {
                isValid = key;
                key = null;

                if(isValid) {
                    for(var i in self.$error) {
                        Vue.delete(self.$error, i);
                    }
                }
            } else {
                if(isValid){
                    Vue.delete(self.$error, key);
                } else {
                    Vue.set(self.$error, key, true);
                }
            }

            self.$valid = isValid;
            self.$invalid = !isValid;

            if (isValid) {
                Vue.util.addClass(self.$el, validClass);
                Vue.util.removeClass(self.$el, invalidClass);
            } else {
                Vue.util.removeClass(self.$el, validClass);
                Vue.util.addClass(self.$el, invalidClass);
            }
        }

        function setDirty(self) {
            self.$dirty = true;
            self.$pristine = false;
            Vue.util.addClass(self.$el, dirtyClass);
            Vue.util.removeClass(self.$el, pristineClass);
        }

        function setPristine(self) {
            self.$dirty = false;
            self.$pristine = true;
            Vue.util.addClass(self.$el, pristineClass);
            Vue.util.removeClass(self.$el, dirtyClass);
        }

        function setSubmitted(self, submitted) {
            self.$submitted = submitted;

            if(submitted) {
                Vue.util.addClass(self.$el, submittedClass);
            } else {
                Vue.util.removeClass(self.$el, submittedClass);
            }
        }

        function attachForm(vm) {
            var vform,
                vmTree = [];

            while (!vm.hasOwnProperty('vform')) {
                vmTree.push(vm);

                vm = vm.$parent;
                if(!vm) {
                    throw new Error('v-validate must be declared inside v-form!');
                }
            }

            vform = vm['vform'];
            vmTree.forEach((branch)=>{
                branch.$set('vform', vform);
            });

            return vm['vform'];
        }

        function setPending(self, value) {
            if(value === undefined)
                value = true;
            else
                value = !!value;

            self.$pending = value;
            return value;
        }

        function detachFrom(vm, vname) {
            var vmTree = findPath(vm),
                vform = vm['vform'],
                cinput, compare;

            for(var i in vform.$controls) {
                cinput = vform.$controls[i];
                if(cinput.$name === vname)
                    continue;

                compare = compareTree(cinput.$vm, vmTree);
                if(compare === true) {
                    return;
                } else if(compare && compare.length) {
                    vmTree = compare;
                }
            }

            vmTree.forEach(function(branch) {
               branch.$delete('vform');
            });

            function findPath(vm) {
                var vmTree = [];

                while (vm.hasOwnProperty('vform')) {
                    vmTree.push(vm);

                    vm = vm.$parent;
                    if(!vm || !vm.hasOwnProperty('vform')) {
                        break
                    }
                }

                return vmTree;
            }

            function compareTree(vm, baseTree) {
                var index;

                while (vm.hasOwnProperty('vform')) {
                    index = baseTree.indexOf(vm);

                    if(index === 0) {
                        return true;
                    } else if(index !== -1) {
                        return baseTree.slice(0, index);
                    }

                    vm = vm.$parent;
                    if(!vm || !vm.hasOwnProperty('vform')) {
                        break
                    }
                }

                throw new Error('Inconsistent vm tree');
            }
        }

        class Input {
            constructor(el, vm, name, vform) {
                this.$dirty = false;
                this.$pristine = true;
                this.$valid = true;
                this.$invalid = false;
                this.$error = {};
                this.$value = null;
                this.$pending = false;

                Object.defineProperties(this, {
                    $vm: {
                        value: vm
                    },
                    $name: {
                        value: name
                    },
                    $el: {
                        value: el
                    },
                    $form: {
                        value: vform
                    }
                });

               vform.$addControl(this);
            }

            $setPending(value) {
                setPending(this, value);
                this.$form.$setPending(value);
            }

            $validate() {
                validation.call(this, this.$name, this.$value, this.$form.$schema);
            }

            $setDirty() {
                setDirty(this);
                this.$form.$setDirty();
            }

            $setPristine() {
                setPristine(this);
                this.$form.$setPristine(true);
            }

            $setValidity(key, isValid) {
                setValidity(this, key, isValid);
                this.$form.$setValidity(key, isValid);
            }
        }

        class Form {
            constructor(el, vm, schema) {
                this.$dirty = false;
                this.$pristine = true;
                this.$valid = true;
                this.$invalid = false;
                this.$submitted = false;
                this.$error = {};
                this.$pending = false;

                Object.defineProperties(this, {
                    $el: {
                        value: el
                    },
                    $vm: {
                        value: vm
                    },
                    $controls: {
                        value: {}
                    },
                    $schema: {
                        value: schema
                    }
                });

                vm.$set('vform', this);
            }

            $setPending(value, fromChild) {
                if(fromChild && (!value && value !== undefined)) {
                    for(var i in this.$controls) {
                        if(this.$controls[i].$pending) {
                            return
                        }
                    }
                }

                setPending(this, value);
            }

            $setValidity(key, isValid) {
                setValidity(this, key, isValid);
            }

            $setDirty() {
                setDirty(this);
            }

            $setPristine(fromChild) {
                if(fromChild) {
                    for(var i in this.$controls) {
                        if(this.$controls[i].$dirty) {
                            return
                        }
                    }
                }

                setPristine(this);
            }

            $setSubmitted(isSubmitted) {
                setSubmitted(this, isSubmitted);
            }

            $validate() {
                for(var i in this.$controls) {
                    this.$controls[i].$validate();
                }
            }

            $removeControl(vinput, replace) {
                if(!replace)
                    detachFrom(vinput.vm, vinput.$name);

                this.$vm.$delete('vform.'+vinput.$name);
                delete this.$controls[vinput.$name];
            }

            $addControl(vinput) {
                this.$vm.$set('vform.'+vinput.$name, vinput);
                this.$controls[vinput.$name] = vinput;
            }

            get $value() {
                var values = {};
                for(var i in this.$controls) {
                    values[i] = this.$controls[i].$value;
                }
                return values;
            }
        }

        Vue.directive('form', {
            priority: 10002,
            deep: true,
            bind: function () {
                var el = this.el,
                    vm = this.vm,
                    isForm = (el.tagName === 'FORM'),
                    schema = vm.$eval(this.expression);

                var vform = this.$form = new Form(el, vm, schema);
                vform.$setPristine();
                vform.$setValidity(true);
                vform.$setSubmitted(false);

                if(isForm) {
                    el.novalidate = true;
                    Vue.util.on(el, 'submit', this.submit);
                }

                this.vm.$set('vform', vform);
            },
            submit: function () {
                this.$form.$setSubmitted(true);
            },
            update: function (schema) {
                this.$form.$schema = schema;
                this.$form.$validate();
            },
            unbind: function () {
                if(this.el.tagName === 'FORM') {
                    Vue.util.off(this.el, 'submit', this.submit);
                }
                
                for(var i in this.$form.$controls) {
                    this.$form.$removeControl(i);
                }
                
                this.vm.$delete('form');
            }
        });

        Vue.directive('validate', {
            id: 'validate',
            priority: 10001,
            bind: function () {
                var vModel = this.el.getAttribute('v-model'),
                    el = this.el,
                    scope, model;

                if (this._scope) {
                    scope = this._scope;
                } else {
                    scope = this.vm;
                }

                var name = this.arg || scope.$eval(this.expression);

                if (!name) {
                    console.error('Name attribute must be populated');
                    return;
                }

                var vform = attachForm(scope),
                    vinput = this.$input = new Input(el, scope, name, vform);

                vinput.$setPristine();
                vinput.$setValidity(true);

                var first = true;
                if(vModel) {
                    scope.$watch(vModel, function (value) {
                        if (!first) {
                            vinput.$setDirty();
                        }
                        first = false;

                        vinput.$value = value;
                        vinput.$validate();
                    }, { immediate: true });
                }
            },
            update: function(name) {
                if(!this.$input)
                    return;

                var vinput = this.$input,
                    vform = vinput.$form;

                vform.$removeControl(vinput, true);
                vinput.$name = name;
                vform.$addControl(vinput)
            },
            unbind: function () {
                if(!this.$input)
                    return;

                var vinput = this.$input,
                    vform = vinput.$form;

                vform.$removeControl(vinput.name);
            }
        });
    };

    if (typeof exports == "object") {
        module.exports = vueForm;
    } else if (typeof define == "function" && define.amd) {
        define([], function () { return vueForm });
    } else if (window.Vue) {
        window.vueForm = vueForm;
        Vue.use(vueForm);
    }

})();