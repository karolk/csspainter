/**
Copyright (C) 2012 Karol Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//IE
/*@cc_on
if (!Array.prototype.forEach)
{
  Array.prototype.forEach = function(fun, thisp)
  {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this)
        fun.call(thisp, this[i], i, this);
    }
  };
}
@*/

(function(global) {

    var inherit = function(obj) {
            var F = function() {};
            F.prototype = obj;
            return new F();
        },
    
        inherit_prototype = function(sub, sup) {
            var proto = inherit(sup.prototype);
            proto.constructor = sub;
            sub.prototype = proto;
        },
        
        inherit_from = function(sup) {
            inherit_prototype(this, sup);
        };
        
    global.Class = function(fn) {
        fn.inherit_from = inherit_from
        return fn;
    }
    
})(self);

(function($, global) {
    
    var events = {},
        spare_obj = {};
        
        event_exists = function(event_name) {
            return !!events[event_name];
        },
    
        for_all_subscribers = function(event_name, fn) {
            if (event_exists(event_name)) {
                var objs = events[event_name];
                for (var i=0, l=objs.length; i<l; i++) {
                    fn(objs[i], objs, i);
                }
            }
        },
        
        create_if_none = function(event_name, cfg) {
        
            event_exists(event_name) || (events[event_name] = []);
            cfg && cfg.sticky && (events[event_name].sticky = true);
            cfg && cfg.data && (events[event_name].data = cfg.data);
        
        },
        
        dispatch_event = function(event_name, cfg) {
            
            cfg && cfg.sticky && create_if_none(event_name, cfg);
            
            for_all_subscribers(event_name,
                                function(subscriber) {
                                    trigger(subscriber, event_name, (cfg && cfg.data));
                                });
        },
    
        subscribe = function(obj, event_name) {
        
            create_if_none(event_name)
            events[event_name].push(obj);
            //if event is sticky it will be dispatch every time object subscribes to this
            //just for this object
            events[event_name].sticky && trigger(obj, event_name, events[event_name].data);
        
        },
        
        //wrapper on jQuery bind
        bind = function(obj, event_name, event_handler) {
          
          arguments.length === 3 && $(obj).bind(event_name, event_handler);
          arguments.length === 2 && ( bind(spare_obj, arguments[0], arguments[1]),subscribe(spare_obj, arguments[0]) );
        
        },
        
        //wrapper on jQuery trigger
        trigger = function(obj, event_name, data) {
          $(obj).trigger(event_name, data);
        },
        
        unsubscribe = function(obj, event_name) {
        for_all_subscribers(event_name, 
                            function(subscriber, all_subscribers, index) {
                                if (subscriber === obj) {
                                    all_subscribers.splice(index,1);
                                }
                            });
        };
    
    global.E = {
        
        publish: dispatch_event,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        bind: bind,
        
        //peek into events
        __events: function() {
          return events;
        }
        
    };
    
})(jQuery, self);

(function($, global) {
    
    var components = {
        
        toolbox: Class(function(context) {
        
            $('.editable')
            .resizable(
                {
                    containment:'#canvas',
                    autoHide: true,
                    stop: function(e, ui) {
                        E.publish('size_changed', {data:[ui]});
                    },
                    resize: function(e, ui) {
                        E.publish('size_changed', {data:[ui]});
                    }
                }
             )
            .draggable(
                {
                    containment:'#canvas',
                    stop: function(e, ui) {
                        E.publish('position_changed', {data:[ui]});
                    },
                    drag: function(e, ui) {
                        E.publish('position_changed', {data:[ui]});
                    }
                }
            );
            
            $('.editor').live('click', function() {
                $('.editor').not(this).css('background-color', '');
                $(this).css('background-color', '#EEEEEE');
                E.publish('palette_selected', {data:[$.data(this,'parent')]})
            });
            
            //this belongs to Element.UI
            this.livetext = function(e, new_text) {
                $('.editable.selected span').text(new_text);
            }
            
            E.bind(this, 'element_text_changed', this.livetext);
            E.subscribe(this, 'element_text_changed');
        
        }),
        
        palette: Class(function(context) {
        
            var me = this,
                palette_node = $('.palette.'+context.type),
                return_false = function() {return false},
                add_button = palette_node.find('.add'),
                remove_button = palette_node.find('.del');
                
            add_button.click(context.handle_add);
            remove_button.click(context.handle_remove);
            
            var handle_change = function() {
                var is_enabled = toggle_enable_node.is(':checked') 
                context.toggle_enable(is_enabled);
                is_enabled ? me.enable(true) : me.disable(true);
            }
            
            var toggle_enable_node = palette_node.find('.toggle_enable').change(handle_change);
            
            me.disable = function(skip_checkbox) {
                skip_checkbox || toggle_enable_node.removeAttr('checked');
                add_button.attr('disabled', 'disabled').unbind('click').click(return_false);
                remove_button.attr('disabled', 'disabled').unbind('click').click(return_false);
            }
            
            me.enable = function(skip_checkbox) {
                skip_checkbox || toggle_enable_node.attr('checked','checked');
                add_button.removeAttr('disabled').unbind('click').click(context.handle_add);
                remove_button.removeAttr('disabled').unbind('click').click(context.handle_remove);
            }
            
            //init
            if (toggle_enable_node.is(':checked') !== context.enabled) {
                context.enabled ?  me.enable() : me.disable();
            }
            
        }),
        
        css_property: Class(function(context) {
        
        var me = this;
        
        this.selector = '.'+context.property+'.editor'
        
        this.$node = cache.find(this.selector).clone();
        
        $.data(this.$node[0], 'parent', context.parent)
        
        this.$editor_node = $(context.editor_selector+' .bd');
        
        //set values if passed
        var cfg = context.cfg, input_node;
        if (cfg) {
            for (var c in cfg) {
                input_node = this.$node.find("[name="+c+"]");
                cfg[c] === 'on' ? input_node.attr("checked","checked") : input_node.val(cfg[c]);
            }
        }
        
        //setup picker
        var picker_node = this.$node.find('.picker'),
            picker_instance = picker_node.length && (new jscolor.color(picker_node[0], {}));
            picker_instance && picker_instance.fromString((cfg && cfg.rgb||random_hex_color()));
        
        var angle_picker_node = this.$node.find('.angle_picker');
            if (angle_picker_node.length) {
                var input_rotate = this.$node.find('input[name=transform]'),
                    angle_picker_instance = new components.angle_picker({
                    node:angle_picker_node[0],
                    change:function(deg) {
                      input_rotate.val(deg);
                      handle_change();
                    }
                })
            }   

        //setup sliders
        this.sliders = setup_sliders(this.$node);
        
        //attach
        this.$editor_node.prepend(this.$node);
        
        //events
        var handle_change = function() {
            context.handle_input(me.$node.serializeArray());
        }
        
        this.$node.find('input, select').change(handle_change);
        this.$node.submit(function() {return false})
        
        handle_change();
            
        }),
        
        angle_picker: Class(function(conf) {
    
            var dragging = false,
                $node = $(conf.selector||conf.node),
                $rotate = $node.find('.rotate'),
                offset, left, top,
                width, height;
                        
            $node
                .bind('mousedown', function() {
                    dragging = true;
                    offset = $node.offset();
                    left = Math.round(offset.left);
                    top = Math.round(offset.top);
                    width = $node.width();
                    height = $node.height();
                })
                .bind('mouseup', function() {
                    dragging = false
                })
                .bind('mousemove', function(e) {
                    if(dragging) {
                      var a = [e.pageX-left-(width/2), -(e.pageY-top-(height/2))]
                      var deg = Math.round(Math.atan2(a[0], a[1]) * 57.2957795)
                      deg = deg > 0 ? deg : 360+deg;                      
                      var rs = $rotate[0].style, def = 'rotate('+deg+'deg)';
                      rs.MozTransform = rs.WebkitTransform = rs.OTransform = def;
                      conf.change && conf.change(deg, $node);
                    }
                });
    
        })
        
    };
    (function(proto) {
        
        proto.getInput = function() {
            return this.$node.serializeArray();
        }
        
        proto.remove = function() {
            this.$node.remove();
        }
        
        proto.enable = function() {
            this.$node.find('input, select, textarea').removeAttr('disabled');
            this.$node.find('.range').slider('enable')
        }
        
        proto.disable = function() {
            this.$node.find('input, select, textarea').attr('disabled', 'disabled');
            this.$node.find('.range').slider('disable')
        }
        
    })(components.css_property.prototype);
    
    components['box-shadow'] = Class(function(context) {
        components.css_property.call(this, context);
    });
    components['box-shadow'].inherit_from(components.css_property)
    
    components['text-shadow'] = Class(function(context) {
        components.css_property.call(this, context);
    });
    components['text-shadow'].inherit_from(components.css_property)
    
    components['text'] = Class(function(context) {
        components.css_property.call(this, context);
        
        var me = this, lt,
            proto_disable = me.disable,
            proto_enable = me.enable;
        
        this.enable = function() {
            proto_enable.call(me)
            me.livetext();
        }
        
        this.disable = function() {
            proto_disable.call(me)
            me.stop_livetext();
        }
        
        this.livetext = function() {
            lt = setInterval(function() {
                E.publish('element_text_changed', {data:[me.$node.find('textarea').val()]})
            }, 250);
        }
        
        this.stop_livetext = function() {
            clearInterval(lt);
            E.publish('element_text_changed', {data:['']})
        }
        
        this.livetext();

    });
    components['text'].inherit_from(components.css_property);
    
    components['border-radius'] = Class(function(context) {
        components.css_property.call(this, context);
    });
    components['border-radius'].inherit_from(components.css_property)
    
    components.size = Class(function(context) {
        components.css_property.call(this, context);
    });
    components.size.inherit_from(components.css_property)
    
    
    components.position = Class(function(context) {
        components.css_property.call(this, context);        
    });
    components.position.inherit_from(components.css_property)
    
    components.transform = Class(function(context) {
        components.css_property.call(this, context);
    });
    components.transform.inherit_from(components.css_property);
    
    var dependencies = ['templates/editor.html #root'],
    cache = $('<div/>'),
    
    formatter = {
        no_alpha: function(input) {
            var ret=[];
            for (var i in input) {
                ret.push(input[i]);
            }
            return ret.join(' ');
        },
        with_alpha: function(input) {
            var ret=[],
            rgb = input['rgb'];
            input['inset'] && ret.push(input['inset'])
            input['offset_x'] && ret.push(input['offset_x'])
            input['offset_y'] && ret.push(input['offset_y'])
            input['blur'] && ret.push(input['blur'])
            rgb && (ret.push('rgba('+
            [parseInt(rgb.substr(1,2),16),parseInt(rgb.substr(3,2),16),parseInt(rgb.substr(5,2),16),(isNaN(Number(input['alpha']))?1:Number(input['alpha']))].join(',')+
                        ')'));
                        
            return ret.join(' ');
        }
    },
    
    input_parser = {
        inset:function(val) {return (val==='on'?'inset':'')},
        pixels:function(val) {return (val && ~~val && ~~val+'px')||'0'},
        rgb:function(val) {return '#'+(val||'000000')},
        alpha:function(val) {return val||''},
        as_is:function(val) {return val+''},
        transform:function(val) {return 'rotate('+val+'deg)'},
        "text-align": function(val) {return ['left', 'center', 'right'][+val]}
    };
    
    input_parser.offset_x = input_parser.offset_y = input_parser.blur = input_parser.width = input_parser.height = input_parser.top = input_parser.right = input_parser.bottom = input_parser.left = input_parser.radius = input_parser['font-size'] = input_parser.pixels;
    
    input_parser['font-family'] = input_parser.as_is;
    
    input_parser.color = input_parser.rgb;
        
    var setup_sliders = (function() {

        if ($.browser.mozilla && parseFloat($.browser.version)<2) {
            var use_jqui = function($root) {
            
                //jQuery 1.4.2 has a bug that doesn't allow for finding input[type=range]
                //if parent node is given like this
                //$('#parent').find('[type="range"]')
                //or
                //$('[type="range"]', #parent)
                
                //luckily this works
                //$('#parent '[type="range"]')
                //so we need to concatenate strings
                var sliders = {};
                
                $root.find('.range_input').each(function(i, node) {
                    var $node = $(node),
                    min = parseInt($node.attr('min'),10),
                    max = parseInt($node.attr('max'),10),
                    step = parseFloat($node.attr('step'))||1,
                    value = parseFloat($node.attr('value'))||1,
                    range = $('<div/>', {'class':'range'}).slider({
                        min:min,
                        max:max,
                        step:step,
                        value:value,
                        change: function(event, ui) {
                            $node.val(ui.value).trigger('change');
                        },
                        slide: function(event, ui) {
                            $node.val(ui.value).trigger('change');
                        }
                    
                    });
                    $node.hide()
                    range.insertBefore($node);
                    sliders[$node.attr('name')] = range;
                });
                
                return sliders;
                
            };
            
            return function($root) {
                var sliders = use_jqui($root);
                return {
                    val:function(new_val) {
                        for (var i in new_val) {
                           sliders[i] && sliders[i].slider('value', new_val[i]) 
                        }
                    }, 
                }
            }
            
        }
        else {
        
            return function($root) {
                
                var sliders = $root.find('.range_input');
                
                return {
                    val:function(new_val) {
                        for (var i in new_val) {
                           var slider = sliders.filter('[name='+i+']')
                           slider.length && slider.attr('value', new_val[i]).trigger('change')
                        }
                    }
                }
            }
        
        }
        
    })(),

    //thanks @rem
    random_hex_color = function() {
        return (function(h){return '000000'.substr(0,6-h.length)+h})((~~(Math.random()*16777215)).toString(16)).toUpperCase();
    },
    
    picker2rgb = function(picekrRGBarray) {
        var ret = [];
        pickerRGBarray.forEach(function(elem) {
            ret.push(~~(255*elem));
        });
        return ret;
    },

    dash2camel = function(str) {
        return str.replace(/-(\w){1}/g, function(match, group1) {
            return group1.toUpperCase()
        });
    },

    
    
/* CSS property editor staple */    
    
  
    CSSPropertyEditor = Class(function(cfg) {
        
        var me = this;
        
        this.state.parent = me;
        
        this.state.handle_input = function(input) {
            me.createCSS(input);
            setTimeout(Toolbox.updateNotify,1);
        }
        this.state.handle_delete = function(e) {
            me.remove();
            e.preventDefault();
        }

    });
    (function(proto){
    
        proto.state = {}
        
        proto.selectable = true;
        proto.disabled = false;
        
        proto.createCSS = function(input) {
            var ret = [],
            parsed = {};
            
            input.forEach(function(elem) {
                    input_parser[elem.name] && input_parser[elem.name](elem.value) && (parsed[elem.name] = input_parser[elem.name](elem.value));
            })
            
            this.updateCSS(parsed);
            
        }
        
        proto.updateCSS = function(parsed_css) {
            this.rules = parsed_css;
        }
        
        proto.getCSS = function() {
        
            var ret = [],  me = this;
            
            me.refresh();
            
            me.property.forEach(function(elem) {
                me.prefixes.forEach(function(prefix) {
                    ret.push([prefix+elem, dash2camel(prefix+elem), me.rules[elem]])
                })
            })
            
            return ret;
        
        }
        
        proto.getInput = function() {
        
            return this.UI.getInput()
        
        }
        
        proto.refresh = function() {
            
            this.createCSS(this.getInput());
            
        }
        
        proto.remove = function() {
            
            this.UI.remove();
            Toolbox.removeNotify(this);
            
        }
        
        proto.enable = function() {
            
            this.selectable = true;
            this.disabled = false;
            this.UI.enable();
            setTimeout(Toolbox.updateNotify,1);
            
        }
        
        proto.disable = function() {
            
            this.selectable = false;
            this.disabled = true;
            this.UI.disable();
            setTimeout(Toolbox.updateNotify,1);
            
        }
        
        proto.destroy = function() {
        
            this.UI.remove();
        
        }
        
        proto.prefixes = [''];
        
    })(CSSPropertyEditor.prototype)
    
    var BoxShadowEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['box-shadow'];
        
        this.type = 'box-shadow';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.createCSS = function(input) {
            
            var ret = [],
                formatter_type = 'no_alpha',
                parsed = {},
                output = {};
                
                input.forEach(function(elem) {
                    input_parser[elem.name] && input_parser[elem.name](elem.value) && (parsed[elem.name] = input_parser[elem.name](elem.value));
                    //choose formatter_type
                    (elem.name === 'alpha' && elem.value) ? (formatter_type = 'with_alpha') : (formatter_type = 'no_alpha') 
                })
                   
                ret.push(formatter[formatter_type](parsed));
                
                output[me.type] = ret.join(',')
                
            this.updateCSS(output);
        
        };
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.prefixes = ['', '-moz-', '-webkit-', '-o-'];

        this.UI = new components[this.type](this.state)
        
        this.refresh()
    
    });
    BoxShadowEditor.inherit_from(CSSPropertyEditor);
    
    var TextShadowEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['text-shadow'];
        
        this.type = 'text-shadow';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.createCSS = function(input) {
            
            var ret = [],
                formatter_type = 'no_alpha',
                parsed = {},
                output = {};
                
                input.forEach(function(elem) {
                    input_parser[elem.name] && input_parser[elem.name](elem.value) && (parsed[elem.name] = input_parser[elem.name](elem.value));
                    //choose formatter_type
                    (elem.name === 'alpha' && elem.value) ? (formatter_type = 'with_alpha') : (formatter_type = 'no_alpha') 
                })
                   
                ret.push(formatter[formatter_type](parsed));
                
                output[me.type] = ret.join(',')
                
            this.updateCSS(output);
                  
        };
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.UI = new components[this.type](this.state)
        
        this.refresh()
    
    });
    TextShadowEditor.inherit_from(CSSPropertyEditor);
    
    var BorderRadiusEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['border-radius'];
        
        this.type = 'border-radius';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.createCSS = function(input) {
            
            var ret = [],
                parsed = {},
                output = {};
                
                input.forEach(function(elem) {
                    input_parser[elem.name] && input_parser[elem.name](elem.value) && (parsed[elem.name] = input_parser[elem.name](elem.value));
                    //choose formatter_type
                })
                   
                ret.push(formatter['no_alpha'](parsed));
                
            output[me.type] = ret.join(',')
                
            this.updateCSS(output);
        
        };
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.prefixes = ['', '-moz-', '-webkit-', '-o-'];
        
        this.UI = new components[this.type](this.state)
        
        this.refresh()
    
    });
    BorderRadiusEditor.inherit_from(CSSPropertyEditor);
    
    var TextEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['font-size', 'font-family', 'text-align', 'color'];
        
        this.type = 'text';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.UI = new components[this.type](this.state)
        
        this.refresh()
    
    });
    TextEditor.inherit_from(CSSPropertyEditor);
    
    var SizeEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['width', 'height']
        
        this.type = 'size';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.UI = new components[this.type](this.state)
        
        this.refresh();
        
        E.bind(this, 'size_changed', function(e, ui) {
            this.UI.sliders.val(ui.size);
        });
        
        E.subscribe(this, 'size_changed');
        
    
    });
    SizeEditor.inherit_from(CSSPropertyEditor);
    
    var PosEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['top', 'left'];
        
        this.type = 'position';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.UI = new components[this.type](this.state)
        
        this.refresh()
        
        E.bind(this, 'position_changed', function(e, ui) {
            this.UI.sliders.val(ui.position);
        });
        
        E.subscribe(this, 'position_changed');
    
    })
    
    PosEditor.inherit_from(CSSPropertyEditor);

    var TransformEditor = Class(function(cfg) {
    
        CSSPropertyEditor.call(this)
        
        var me = this;
        
        this.property = ['transform'];
        
        this.type = 'transform';
        
        this.state.editor_selector = '#editor .palette.'+me.type;
        
        this.state.cfg = cfg;
        
        this.state.property = this.type;
        
        this.prefixes = ['', '-moz-', '-webkit-', '-o-'];
        
        this.UI = new components[this.type](this.state)
        
        this.refresh()

    });
    
    TransformEditor.inherit_from(CSSPropertyEditor);
    
    var Palette = Class(function(type) {
        
        var enabled = true;
        
        function handle_add() {
            Toolbox.createCSSPropEditor(type);
        }
        
        function handle_remove() {
            E.publish('selected_palette_removed', {data:[type]})
        }
        
        function toggle_enable(status) {
            enabled = status;
            E.publish('palette_enable_toggle', {data:[type, enabled]})
        }
        
        this.disable = function() {
            toggle_enable(false);
            this.UI.disable();
        }
        
        this.UI = new components.palette({
            type: type,
            handle_add:handle_add,
            handle_remove:handle_remove,
            toggle_enable:toggle_enable,
            enabled: enabled
        })
        
    });

/* Editor */

    var Toolbox = new (function() {
    
        var me = this,
            stylesheet,
            rules = [],
            editor_types = {
                'box-shadow': BoxShadowEditor,
                'text-shadow': TextShadowEditor,
                'text': TextEditor,
                'border-radius': BorderRadiusEditor,
                'size': SizeEditor,
                'position': PosEditor,
                'transform': TransformEditor
            },
            element_node = $('.editable.selected')[0],
            element_style = element_node.style,
            $css_node = $('#css'),
            editors = {},
            palettes = {},
            active_editor;
        
        for (var e in editor_types) {
            palettes[e] = new Palette(e);
        }
        
        me.createCSSPropEditor = function(type, cfg) {
            editors[type] || (editors[type] = []);
            type && editor_types[type] && editors[type].unshift(new editor_types[type](cfg));
        };
        
        me.updateCSS = function() {
            
            var new_css = me.getCSS(), merged_style, before_dec = "<br>&nbsp;&nbsp;", css_rules = [], css_code = '.my_div'+' {'+before_dec;

            new_css.forEach(function(same_property) {
                
                var property_rules = [], property_css=[], first = same_property[0];
                
                first && same_property.forEach(function(elem, index) {
                        elem.forEach(function(line, index) {
                            property_rules[index] || (property_rules[index] = []);
                            property_rules[index].push(line[2])
                        })
                });
                
                first && first.forEach(function(elem, index) {
                    var is_not_empty = (property_rules[index].join('')).length > 0;
                    element_style[elem[1]] = (is_not_empty ? property_rules[index].join(', ') : '');
                    is_not_empty && property_css.push(elem[0]+': '+property_rules[index].join(', '));
                });
                
                css_rules = css_rules.concat(property_css);
                
            });
            
            css_code += css_rules.join(";"+before_dec);
            $css_node.html(css_code+';<br>}');
            
        };
        
        me.getCSS = function() {
            var ret = []
            
            for (var i in editors) {
                var property = [];
                editors[i].forEach(function(elem) {
                    !property.disabled && property.push(elem.getCSS())
                })
                ret.push(property);
            }

            return ret;
        };
        
        me.updateElement = function(selector) {
            var elem = (selector && $(selector)[0]) || element_node,
                es = elem.style;
                
        };
        
        me.updateNotify = function() {
        
            me.updateCSS();
        
        };
        
        me.removeNotify = function(removed) {
            
            if (editors[removed.property]) {
                editors[removed.property].forEach(function(elem, index) {
                    elem === removed && editors[removed.property].splice(index, 1);
                })
            }
            
            me.updateNotify();
            
        };
        
        me.count = function(type) {
            return editors[type] ? editors[type].length : 0;
        };
        
        me.purge = function(type) {
            
            if (type) {
                
                editors[type].forEach(function(elem) {
                        
                    elem.destroy();
                    
                });
                
                editors[type] = [];
                
            }
            
            else {
            
                for (var e in editors) {
                    
                    editors[e].forEach(function(elem) {
                            
                        elem.destroy();
                        
                    });
                    
                }
                
                editors = {};
            
            }
            
            me.updateCSS();
            
        };
        
        me.disable = function(type) {
            (type in palettes) && palettes[type].disable();
        }
        
        me.to_json = function() {
    
            var ret = [],
            value_map = {
                'on':true
            },
            name_map = {
                'offset_x':'x',
                'offset_y':'y'
            };
            
            for (var e in editors) {
            
                editors[e].forEach(function(elem) {
                    var input = elem.getInput();
                    var obj = {}
                    input.forEach(function(elem) {
                        //numbers as numbers, then remap values, then original value
                        elem.value && (obj[name_map[elem.name]||elem.name] = Number(elem.value)||value_map[elem.value]||elem.value)
                    })
                    ret.unshift({type:elem.type, data: obj})
                })
            
            }
            
            return JSON.stringify(ret);
        
        };
        
        me.from_json = function(inp) {
    
            var json_obj = inp && JSON.parse(inp),
                value_map = {
                    'true':'on'
                },
                name_map = {
                    'x':'offset_x',
                    'y':'offset_y'
                };
            
            if (json_obj) {
                
                read_rules = {}
                
            }
            
            json_obj.forEach(function(elem) {
                var rule = {}
                for (var e in elem.data) {
                    rule[name_map[e]||e] = value_map[elem.data[e]+'']||elem.data[e]+'';
                }
                read_rules[elem.type] || (read_rules[elem.type] = []);
                read_rules[elem.type].push(rule)
            });
                        
            for (var type in editors) {
                if (type in read_rules) {
                   Toolbox.purge(type);
                   read_rules[type].forEach(function(prop) {
                    Toolbox.createCSSPropEditor(type, prop);
                   })
                }
                else {
                   Toolbox.disable(type)
                }
            }        
        };
        
        me.UI = new components.toolbox({})
        
        E.bind(me, 'palette_selected', function(e, editor) {
            active_editor = editor
        });
        E.subscribe(me, 'palette_selected');
        
        E.bind(me, 'selected_palette_removed', function(e, type) {
            active_editor && active_editor.type === type && active_editor.remove();
        });
        E.subscribe(me, 'selected_palette_removed');
        
        E.bind(me, 'palette_enable_toggle', function(e, type, status) {
            editors[type] && editors[type].forEach(function(elem) {
                status ? elem.enable() : elem.disable();
            })
        });
        E.subscribe(me, 'palette_enable_toggle');


    }),
    
    init = function() {
    
        cache.load(dependencies[0], function() {
            
           Toolbox.createCSSPropEditor('box-shadow');
           Toolbox.createCSSPropEditor('text-shadow');
           Toolbox.createCSSPropEditor('text');
           Toolbox.createCSSPropEditor('border-radius');
           Toolbox.createCSSPropEditor('size');
           Toolbox.createCSSPropEditor('position');
           Toolbox.createCSSPropEditor('transform');
          
           E.publish('cache_loaded')
           
        })
        
    }
        
    //export
    global.Toolbox = Toolbox;
    
    init();
    
})(jQuery, self);

var examples = {
"purple_and_blue":'[{"type":"box-shadow","data":{"inset":true,"x":-164,"y":-39,"blur":80,"rgb":"EB1B5F","alpha":0.6}},{"type":"box-shadow","data":{"inset":true,"x":"0","y":"0","blur":18,"rgb":"1B4F19"}},{"type":"box-shadow","data":{"inset":true,"x":90,"y":"0","blur":80,"rgb":"00D4E0"}},{"type":"box-shadow","data":{"x":36,"y":"0","blur":99,"rgb":"EB1B5F","alpha":1}},{"type":"box-shadow","data":{"x":-33,"y":"0","blur":68,"rgb":"00D4E0","alpha":0.98}}, {"type":"size","data":{"width":250,"height":250}},{"type":"position","data":{"top":100,"left":100}}, {"type":"border-radius","data":{"radius":0}}]',
"canvas":'[{"type":"position","data":{"top":30,"left":33}},{"type":"size","data":{"width":567,"height":400}},{"type":"border-radius","data":{"radius":"0"}},{"type":"text-shadow","data":{}},{"type":"box-shadow","data":{"x":"0","y":"0","blur":187,"rgb":"000000","alpha":0.15}},{"type":"box-shadow","data":{"x":"0","y":"0","blur":5,"rgb":"C4C4C4","alpha":1}},{"type":"box-shadow","data":{"x":"0","y":"0","blur":"0","rgb":"FFFFFF","alpha":1}},{"type":"box-shadow","data":{"inset":true,"x":"0","y":"0","blur":99,"rgb":"000000","alpha":0.11}}]',
"pink_ball":'[{"type":"box-shadow","data":{"inset":true,"x":"0","y":"0","blur":73,"rgb":"A901AB","alpha":0.41}},{"type":"box-shadow","data":{"inset":true,"x":"0","y":"0","blur":59,"rgb":"EF02F2","alpha":0.24}},{"type":"box-shadow","data":{"inset":true,"x":106,"y":-90,"blur":215,"rgb":"EF02F2","alpha":0.28}},{"type":"box-shadow","data":{"inset":true,"x":-39,"y":37,"blur":"0","rgb":"FFFFFF","alpha":0.24}},{"type":"box-shadow","data":{"x":-33,"y":93,"blur":132,"rgb":"A901AB","alpha":0.57}},{"type":"box-shadow","data":{"inset":true,"x":21,"y":-53,"blur":99,"rgb":"A901AB","alpha":0.25}},{"type":"text-shadow","data":{"x":1,"y":1,"blur":3,"rgb":"C6BC70"}},{"type":"border-radius","data":{"radius":135}},{"type":"size","data":{"width":270,"height":270}},{"type":"position","data":{"top":51,"left":168}}]'
}

var actions = {
    intro:function() {
        $('#intro').removeClass('nodisplay').dialog({modal:true});
    }
}

$('.js_action').click(function(e) {
    var action_name = $(this).attr('href').substr(1);
    (action_name in actions) && actions[action_name]();
    e.preventDefault();
})

function launch_example(found_id) {

  found_id && (found_id in examples) && Toolbox.from_json(examples[found_id]);

}

$('.examples a').click(function() {
    launch_example($(this).attr('href').substr(1));
    return false;
})

E.bind('cache_loaded', function() {
  launch_example(location.hash.substr(1))
});


//var b = [0, 0]; Math.round(Math.atan2(b[0], b[1]) * 57.2957795)