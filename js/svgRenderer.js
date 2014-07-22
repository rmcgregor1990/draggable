

function SvgRenderer(svg_element, width, height) {
    this.snapDistance = 30;
    this.snapPointRadius = 10;

    this.height = height;
    this.width = width;
    this.canvas = SVG(svg_element).size(width, height);
    parentThis = undefined;
    this.snapPoints =  [];
    this.snapPointGroup = undefined;
    this.init();
    this.areaConstaint = {minX: 0 , minY: 0 , maxX: this.width, maxY: this.height};
}


SvgRenderer.prototype = {

    init: function() {
        parentThis = this;
    },

    renderToTree: function() {
        var visitor = new Visitor();
        return visitor.visit(this.masterFrame);
    },

    createFromTree: function(tree) {
        if (tree.type === "MasterFrame") {
            //master frame is ignored as it already exists
            this.masterFrame.addChild(this.createChild(tree.child));
        }
        else
        {
            this.masterFrame.addChild(this.createChild(tree));
        }
    },

    createChild: function(node) {
        if (node === undefined) {
            return;
        }


        if (node.type === 'ParallelFrame') {
            //everything is created wrapped in a serial frame, so we need to be careful
            var child = this.addParallelFrame();
            for (var i = 0; i < node.children.length; i++) {
                child.leftChild().addChild(this.createChild(node.children[i]));
            }
            return child;
        }


        if (node.type === 'SerialFrame') {
            return this.createSerialFromChildList(node.children);
        }


        if (node.type === 'TerminalState') {
            return this.addTerminalState.apply(this, [node.moduleName, node.name, node.args]);
        }
    },


    createSerialFromChildList: function(list) {
        if (list.length === 0) {
            return undefined;
        }
        var serial = this.createChild(list[0]);
        serial.addChild(this.createSerialFromChildList(list.slice(1)));
        return serial;
    },


    addMasterFrame: function() {
        var frame = new SvgRenderer.MasterFrame;
        frame.init();
        this.canvas.add(frame);
        frame.move(250,20);
        this.masterFrame = frame;
    },

    addSideBar: function() {
        var bar = new SvgRenderer.SidebarFrame;
        this.canvas.add(bar);
        bar.init();
        return bar;
    },

    addTerminalState: function(moduleName, name, args) {
        if (name === undefined) name = "tempname";
        if (args === undefined) args = [{name: 'bob'}, {name: 'bill'}];

        var terminalState = new SvgRenderer.TerminalState;
        terminalState.init(moduleName, name, args);
        this.canvas.add(terminalState);
        var frame = this.addSerialFrame(terminalState, this.addTerminalState, [moduleName, name, args]);
        return frame;
    },

    addTerminalStateFromString: function(moduleName, func) {
        re = /([a-zA-Z][a-zA-Z0-9]*)/g;
        var groups = func.match(re);
        var name = groups[0];
        var args = groups.splice(1);
        this.addTerminalState(moduleName, name, args);
    },

    addParallelFrame: function () {

        var frame = new SvgRenderer.ParallelFrame;
        frame.init();
        this.canvas.add(frame);
        frame.plotPoly();
        frame.dragHandle = frame.svgPolygon;
        //everything is inside its own serial frame
        var serial_frame = this.addSerialFrame(frame, this.addParallelFrame, []);
        return serial_frame;
    },


    addSerialFrame: function (first_child, contructionFunction, constructionArgs) {

        var frame = new SvgRenderer.SerialFrame;
        frame.init();
        this.canvas.add(frame);
        var dragHandle = first_child;
        frame.addChild(first_child);

        if (first_child.dragHandle !== undefined) {
            dragHandle = first_child.dragHandle;
        }

        frame.initDraggable(dragHandle, this.areaConstaint);
        frame.dragmove = this._elementOnDrag;
        frame.dragend = this._elementOnStopDrag;
        frame.beforedrag = this._elementOnStartDrag;

        frame.objectConstructor = contructionFunction.bind(this);
        frame.constructionArgs = constructionArgs;
        return frame;
    },


    _groupSnap: function(child, event) {
        for (var i = 0; i < this.snapPoints.length; i++) {
            var snapPoint = this.snapPoints[i];
            if (snapPoint.parent !== child) {
                if (snapPoint.bounds.inside(child.x(), child.y())) {
                    if (snapPoint.snapTo === undefined || snapPoint.snapTo === true) {
                        var dx = (snapPoint.x)-child.x();
                        var dy = (snapPoint.y)-child.y();
                        child.dmove(dx, dy);
                    }
                    return snapPoint;
                }  
            }
        }
        return null;
    },


    _elementOnDrag: function(delta, event) {
        this.remember('snapPoint', parentThis._groupSnap(this, event));
    },


    _elementOnStartDrag: function(delta, event) {
        this.front();
        //do group disconnection, this elememt should now be on the top level
        if (this.parent.removeChild !== undefined) {
            this.parent.removeChild(this, parentThis.canvas);
        }
        //get the possible snap points
        parentThis.updateSnapPoints(this);

    },

    _elementOnStopDrag: function(delta, event) {
        //if the element has never been dragged call the drag function once.
        if (this.remember('snapPoint') === undefined) {
            this.dragmove();
        }

        if (this.remember('snapPoint') !== null){
            var p = this.remember('snapPoint');
            p.parent.addChild(this, p.number);
        }

        parentThis.snapPointGroup.remove();
        this.forget('snapPoint');
    },


    recurseSnapPoints: function(drag_element, parent_obj, points) {
        if (parent_obj !== drag_element && !(parent_obj instanceof SvgRenderer.SidebarFrame)) {
            for (var i = 0; i < parent_obj.children().length; i++) {
                var child = parent_obj.children()[i];
                if (child !== drag_element) {
                    if (child instanceof SvgRenderer.GenericFrame) {
                        points = points.concat(child.getSnapPoints());
                        points = this.recurseSnapPoints(drag_element, child, points);
                    }
                }
            }
        }
        return points;
    },


    updateSnapPoints: function(drag_element) {
        this.snapPoints = [];
        this.snapPoints = this.recurseSnapPoints(drag_element, parentThis.canvas, this.snapPoints);

        //draw on the snap point lockations
        var gradient = this.canvas.gradient('radial', function(stop) {
            stop.at({ offset: 0, color: '#fff' })
            stop.at({ offset: 1, color: '#000' })
        })
        this.snapPointGroup = this.canvas.group();
        for (var i = 0; i < this.snapPoints.length; i++) {
            var p = this.snapPoints[i];
            if (p.bounds === undefined) {
                p.marker = this.snapPointGroup.circle(0).hide();
                p.marker.center(p.x,p.y); //.fill({color: gradient});
                p.marker.addClass("snapPoint");
                //p.marker.attr({'fill-opacity': 0.6, stroke: '#003', 'stroke-width': 1});
                p.bounds = this.canvas.defs().circle(this.snapDistance).center(p.x, p.y);
                this.snapPointGroup.add(p.marker);
                p.marker.animate(500, SVG.easing.elastic).radius(this.snapPointRadius);
            }
        }
    }
}


//Terminal State class, based on a group
SvgRenderer.TerminalState = SVG.invent({
    create: 'g',
    inherit: SVG.G,

    extend:
    {
        init: function(moduleName, name, args) {
            this.spikeHeight = 10;
            this.inputHeight = 30;
            this.headerHeight = 30;

            var input_height = args.length*this.inputHeight;
            var terminalState = this;
            terminalState.moduleName = moduleName;
            terminalState.stateName = name;
            var shape = this.path("M0 0 l 10 0 l 0 10 l 10 -10 l 100 0 l 0 "+(input_height + this.headerHeight).toString()+" l -100 0 l -10 10 l 0 -10 l -10 0 Z");
            //foriegn object to embed the input boxes into
            var fobj = this.foreignObject(100, input_height).attr({id:'fobj'}).move(10, 30);
            for (var i = 0; i < args.length; i++) {
                arg = args[i];
                if (arg.value === undefined) arg.value = '';
                // Not sure if I want to remove these completely
//                fobj.appendChild("label", {for: arg.name, innerText: arg.name, class:'state-argLabel', size: 0, style: 'display: none;'});
                fobj.appendChild("input", {id: arg.name, placeholder: arg.name, title: arg.name, value: arg.value, size: 10, class:'state-argInput'});
            };

            //Module name
            var mod_text = this.text(function(add) {
            add.tspan(moduleName).newLine()}).dx(50);
            mod_text.font({
              family:   'Helvetica'
            , size:     12
            , anchor:   'center'
            , leading:  '1.0em'
            , bold: false
            , weight: 'bold'
            });
            mod_text.addClass("state-module")

            //state name
            var text = this.text(function(add) {
            add.tspan(name).newLine()}).dx(10).dy(5);

            text.font({
              family:   'Helvetica'
            , size:     15
            , anchor:   'left'
            , leading:  '1.5em'
            , bold: true
            , weight: 'bold'
            });

            text.addClass("state-title")

            // the drag handle for this object
            var groupHandle = this.group();
            //the background shape and the text are draggable
            groupHandle.add(shape);
            groupHandle.add(mod_text);
            groupHandle.add(text);
            //add everything to the terminal state group
            terminalState.add(groupHandle);
            terminalState.add(fobj);
            fobj.front();
            this.fobj = fobj;
            terminalState.dragHandle = groupHandle;
            terminalState.addClass("state");
        },

        bbox: function() {
            var box = new SVG.BBox(this);
            box.height = box.height-this.spikeHeight;
            return box;
        },


        getArgs: function () {
            var arg_list = [];
            for (var i = 0; i < this.fobj.node.childNodes.length; i++) {
                var input = this.fobj.node.childNodes[i];
                arg_list.push({name: input.title, value: input.value});
            }
            return arg_list;
        },

        getFunctionString: function () {
            var args = this.getArgs();
            var ans = this.stateName;
            ans += "(";
            for (var i = 0; i < args.length; i++) {
                var value = args[i].value.trim();
                if (value === "") {
                    value = "0";
                }
                ans += value;
                if (i < args.length-1) {
                    ans += ",";
                }
            }
            ans += ")";
            return ans;
        }
    }
})


// Parent Object for all Frame Types
SvgRenderer.GenericFrame = SVG.invent({
    create: 'g',
    inherit: SVG.G,
    extend:
    {
        initDraggable: function(drag_handle, areaConstaint) {
            if (areaConstaint === undefined) areaConstaint = {};
            this.draggable(areaConstaint, drag_handle);
        },

        addChild : function(child, index, update) {
            if (child === undefined) return;
            if (update === undefined) update = true;
            if (index === undefined) index = this.childNodes.length;

                this.childNodes.splice(index, 0, child);
                //the child will now be relative to this group, so needs a change of coord systems
                var pos = this.absPos()
                child.dmove(-pos.x, -pos.y);
                this.add(child); //add to the SVG group
                if (update) {
                    this.update();
                }
        },

        removeChild : function(child, new_container, update) {
            if (update === undefined) update = true;
            var index = this.childNodes.indexOf(child);
            this.childNodes.splice(index, 1);
            if (new_container !== undefined) {

                //child needs to adjusted to the new group relative offset
                var new_box = new_container.rbox();
                var parent_pos = this.absPos();
                var dx = parent_pos.x - new_box.x;
                var dy = parent_pos.y - new_box.y;
                child.dmove(dx, dy);
                new_container.add(child);
            }
            if (update) {
                this.update();
            }
        },

        clearChildren : function(update) {
            if (update === undefined) update = true;

            for (var i = 0; i < this.childNodes.length; i++) {
                this.childNodes.remove();
                this.childNodes.push();
            }

            if (update) {
                this.update();
            }
        },

        getChildSet : function() {
            var set = this.set();
            for (var i = this.childNodes.length - 1; i >= 0; i--) {
                set.add(this.childNodes[i]);
            };

            return set;
        },

        absPos : function() {
            return this.rbox();
        },

        /**
         * this is a recursive update which looks through all the parent objects of this instance
         * @return {None}
         */
        update : function() {
            var obj = this;
            do {
                obj.reorderChildren();
                obj.resizeToChildren();
                obj = obj.parent;
            } while (obj instanceof SvgRenderer.GenericFrame);
        },

        reorderChildren : function() {
        },

        resizeToChildren : function() {
        }
    }
})




//Frame Elements are extentions of SVG groups and also inherit from SVG elements
SvgRenderer.ParallelFrame = SVG.invent({
    create: 'g',
    inherit:  SvgRenderer.GenericFrame,

    extend:
    {
        init: function() {
            //Editable appearance based parameters
            this.spikeHeight = 10;
            this.spikeWidth = 10;
            this.headerHeight= 20;
            this.footerHeight= 10;
            this.sideBarWidth= 10;
            this.childSpacing= 30;
            this.childOverExtend = 50;
            this.emptyDimentions = {width: 80, height: 20} // the interior dimentions when it has no children

            //class private data
            this.childNodes= [];
            this.childStart= {x: this.sideBarWidth, y: this.headerHeight};
            this.svgPolygon= null;
            this.dragHandle= null;
            this.path_array = new SVG.PathArray("M 0 0 l 10 0 l 0 10 l 10 -10 l 140 0 l 0 20 l -10 10 l 0 -10 l -10 0 l -110 0 l -10 10 l 0 -10 l -10 0 l 0 120 l 140 0 l 0 20 l -130 0 l -10 10 l 0 -10 l -10 0 Z");
            this.connectionLine = null;
            //Do an inital resize to get the right starting dims
            this.resizeToChildren();
        },



        setPolyAttrs: function(attrs) {
            if (this.svgPolygon !== null) {
                this.svgPolygon.attr(attrs);
            }
        },

        plotPoly : function(points) {
            if (points === undefined) points = this.path_array;
            if (this.svgPolygon === null)
            {
                this.svgPolygon = this.put(new SVG.Path);
                this.svgPolygon.addClass('frame');
                this.svgPolygon.plot(points);
            }
            this.svgPolygon.plot(points);
        },


        getSnapPoints : function() {
            var points = [];
            var absPos = this.absPos();
            var max_y = absPos.y + this.childStart.y;
            var max_x = absPos.x + this.childStart.x;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                points.push({x: absPos.x + child.x(), y: absPos.y + child.y(), parent: this, number: i});
                max_y = absPos.y + child.y() + child.bbox().height;
                max_x = absPos.x + child.x() + child.bbox().width;
            }

            //add extra empty point at the end
            var x_spacing = 0;
            if (this.childNodes.length  > 0)
            {
                x_spacing = this.childSpacing;
            }
            points.push({x: max_x + x_spacing, y: absPos.y + this.childStart.y, parent: this, number: i});

            return points;
        },

        reorderChildren : function() {
            var x_count = this.childStart.x;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                child.move(x_count, this.headerHeight);
                x_count += child.bbox().width + this.childSpacing;
            };
        },

        bbox: function() {
            var box = new SVG.BBox(this);
            box.height = box.height-this.spikeHeight;
            return box;
        },

        resizeToChildren : function() {
            //fit frame to the combined bounding box of all its children
            var set = this.getChildSet();
            var box = set.bbox();
            if (box.width == 0){
                box = this.emptyDimentions;
            }
            var points = this.path_array;
            points.value[4][1] = this.sideBarWidth + box.width + this.childOverExtend;
            points.value[5][1] = this.sideBarWidth + box.width + this.childOverExtend;
            points.value[6][1] = this.sideBarWidth + box.width + this.childOverExtend - this.spikeWidth;
            points.value[7][1] = this.sideBarWidth + box.width + this.childOverExtend - this.spikeWidth;
            points.value[8][1] = this.sideBarWidth + box.width + this.childOverExtend - this.spikeWidth;


            points.value[13][2] = this.headerHeight + box.height;
            points.value[14][2] = this.headerHeight + box.height;
            points.value[15][2] = this.headerHeight + this.footerHeight + box.height;
            points.value[16][2] = this.headerHeight + this.footerHeight + box.height;
            points.value[17][2] = this.headerHeight + this.footerHeight + box.height + this.spikeHeight;
            points.value[18][2] = this.headerHeight + this.footerHeight + box.height;
            points.value[19][2] = this.headerHeight + this.footerHeight + box.height;
            this.plotPoly(points);

            //redraw the cool connection lines in the frame header
            if (this.connectionLine !== null) {
                this.connectionLine.remove();
                this.connectionLine = null;
            }

            if (this.childNodes.length > 1) {
                this.connectionLine = this.group();
                var y0 = this.headerHeight/4;
                var y1 = this.headerHeight/2;
                var y2 = this.headerHeight;
                for (var i = 0; i < this.childNodes.length; i++) {
                    var child = this.childNodes[i];
                    var x = child.bbox().x + child.childNodes[0].bbox().cx;
                    this.connectionLine.polygon([[x-10, y1], [x+10, y1], [x, y2]]).addClass("parallel-connector-arrowHead");
                    this.connectionLine.line(x, y1, x, y0).addClass("parallel-connector-arrowBody");
                }
                var x1 = set.first().bbox().x + set.first().childNodes[0].bbox().cx;
                var x2 = set.last().bbox().x + set.last().childNodes[0].bbox().cx;
                this.connectionLine.line(x1, y0, x2, y0).addClass("parallel-connector-crossBar");
            }
        }
    }
})


//Serial stacking Frame
SvgRenderer.SerialFrame = SVG.invent({
    create: 'g',
    inherit: SvgRenderer.GenericFrame,

    extend:
    {
       init: function() {
            this.childNodes= [];
            this.connectionLine = null;
            this.headerHeight= 30;
            this.childSpacing= 0;
            this.childStart= {x:0, y: 0};
            this.maxChildren = 2
        },

        leftChild: function() {
            return this.childNodes[0];
        },

        rightChild: function() {
            return this.childNodes[1];
        },


        addChild : function(child, index, update) {
            if (child === undefined) return;
            if (update === undefined) update = true;

            if (this.childNodes.length == this.maxChildren)
            {
                //if index is 2 then append it too the very last serial frame child
                if (index >= this.maxChildren)
                {
                    this.childNodes[this.maxChildren-1].addChild(child);
                    return;
                }
                else
                {
                    child.addChild(this.childNodes.pop(), this.maxChildren);
                }
            }


            this.__proto__.__proto__.addChild.call(this, child, index);
        },

        setPolyAttrs: function(attrs) {
            if (this.svgPolygon !== undefined) {
                this.svgPolygon.attr(attrs);
            }
        },

        plotPoly : function(points) {
            if (points === undefined) points = this.points;
            if (this.svgPolygon === null)
            {
                this.svgPolygon = this.put(SVG.Polygon);
            }
            this.svgPolygon.plot(points);
        },

        getSnapPoints : function() {
            var points = [];
            var absPos = this.absPos();
            var max_y = absPos.y + this.childStart.y, max_x = absPos.x + this.childStart.x;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                //do not allow placement before the first element as it makes no sense.
                if (i > 0) {
                points.push({x: absPos.x + child.x(), y: absPos.y + child.y(), parent: this, number: i});
                }
                max_y = absPos.y + child.y() + child.bbox().height;
                max_x = absPos.x + child.x() + child.bbox().width;
            }
            //add extra empty point at the end but only if there's currently only a single node
            if (this.childNodes.length < this.maxChildren)
            {
                points.push({x: absPos.x + this.childStart.x, y: max_y + this.childSpacing, parent: this, number: i});
            }
            return points;
        },

        reorderChildren : function() {
            var y_count = this.childStart.y;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                child.move(0, y_count);
                y_count += child.bbox().height + this.childSpacing;
            }
        },

        resizeToChildren : function() {
            if (this.connectionLine !== null) {
                this.connectionLine.remove();
                this.connectionLine = null;
            }

            if (this.childNodes.length == 2)
            {
                x = 50;
                y1 = this.childNodes[0].bbox().height;
                y2 = this.childNodes[0].bbox().height + this.childSpacing;
                this.connectionLine = this.polygon([[x-10, y1], [x+10, y1], [x, y2]]);
                this.connectionLine.addClass("serial-connector");
            }
        }
    }
})


//Serial stacking Frame
SvgRenderer.SidebarFrame = SVG.invent({
    create: 'g',
    inherit: SvgRenderer.GenericFrame,

    extend:
    {
       init: function() {
            this.childSpacing= 15;
            this.childStart= {x:10, y: 10};
            this.padding = {x: 10, y: 10};
            this.trashDims = {width: 150, length: 150};
            this.childNodes= [];

            //Shape design
            this.svgShape = this.rect(this.width, this.height);
            this.svgShape.addClass("sidebar");
            this.svgTrash = this.rect(this.trashDims.width, this.trashDims.length);
            this.svgTrash.addClass("trash");
        },


        addChild : function(child, index, update) {
            if (child === undefined) return;
            //-1 means remove this child from its parent entirely, this allows thing dragged onto the side bar to be deleted
            if (index === -1) {
                child.remove();
            }
            else
            {
                this.__proto__.__proto__.addChild.call(this, child, index, update);
            }

            var box = child.bbox();
            child.dmove(-box.width - 40, 0);
            child.animate(500).dmove(box.width + 40, 0);
        },

        removeChild : function(child, new_container, update) {
            var index = this.childNodes.indexOf(child);
            this.__proto__.__proto__.removeChild.call(this, child, new_container, false);
            var new_child = child.objectConstructor.apply(this, child.constructionArgs);
            this.addChild(new_child, index);
        },

        setPolyAttrs: function(attrs) {
            this.svgShape.attr(attrs);
        },

        getSnapPoints : function() {
            var points = [];
            var absPos = this.absPos();
            // only one point for the entire sidebar.
            points.push({x: absPos.x + this.svgTrash.cx(), y: absPos.y + this.svgTrash.cy(), bounds: this.svgTrash, parent: this, number: -1, snapTo: false});

            return points;
        },

        reorderChildren : function() {
            var y_count = this.childStart.y;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                child.move(this.childStart.x, y_count);
                y_count += child.bbox().height + this.childSpacing;
            }
        },

        resizeToChildren : function() {
            var set = this.getChildSet()
            this.svgShape.width(set.bbox().width + this.childStart.x + this.padding.x);
            this.svgShape.height(set.bbox().height + this.childStart.y + this.padding.y);

            this.svgTrash.move(0, this.svgShape.height() + 10);
        }
    }
})


//Serial stacking Frame
SvgRenderer.MasterFrame = SVG.invent({
    create: 'g',
    inherit: SvgRenderer.GenericFrame,

    extend:
    {
       init: function() {
            //tweekables
            this.childStart= {x: 10, y: 10};
            this.padding ={x: 10, y: 10}
            this.emptyDimentions = {width: 100, height: 100};
            //class vars
            this.childNodes= [];
            //Shapes
            this.svgShape= this.rect(100, 100).move(0, 0);
            //this.svgShape.fill({opacity: 0.0});
            //this.svgShape.stroke({ color: '#000000', opacity: 1.0, width: 3, dasharray: [7, 7] });
            this.add(this.svgShape);
            this.svgShape.addClass("masterFrame");
            // this.text("Parallel").leading(0).move(20, 25).font({
            //                                                       family:   'Helvetica'
            //                                                     , size:     20
            //                                                     , anchor:   'left'
            //                                                     , bold: true
            //                                                     , weight: 'bold'
            //                                                     });


            // this.text("Sequential").rotate(90).leading(0).move(25, 0).font({
            //                                                               family:   'Helvetica'
            //                                                             , size:     20
            //                                                             , anchor:   'left'
            //                                                             , bold: true
            //                                                             , weight: 'bold'
            //                                                             });

            //intial resize
            this.resizeToChildren();
        },

        child: function() {
            return this.childNodes[0];
        },

        setPolyAttrs: function(attrs) {
            this.svgShape.attr(attrs);
        },

        getSnapPoints : function() {
            var points = [];
            var absPos = this.absPos();
            // only one point for the entire sidebar.
            if (this.childNodes.length < 1) {
                points.push({x: absPos.x + this.svgShape.x() + this.childStart.x, y: absPos.y + this.svgShape.y() + this.childStart.y, parent: this, number: 0});
            }
            return points;
        },

        reorderChildren : function() {
            if (this.childNodes.length > 0) {
                this.child().move(this.childStart.x, this.childStart.y);
            }
        },

        resizeToChildren : function() {
            var box;
            if (this.childNodes.length == 0) {
                box = this.emptyDimentions;
            }
            else {
                box = this.getChildSet().bbox();
            }

            this.svgShape.width(box.width + this.childStart.x + this.padding.x);
            this.svgShape.height(box.height + this.childStart.y + this.padding.y);
        }
    }
})


//helpstuff stuff
//a proper string formater
if (!String.format) {
  String.format = function(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number] 
        : match
      ;
    });
  };
}





