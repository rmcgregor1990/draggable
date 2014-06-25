

function SvgRenderer(svg_element) {
    this.height = svg_element.height;
    this.width = svg_element.width;
    this.canvas = SVG(svg_element);
    this.snapDistance = 30;
    this.init();

    this.areaConstaint = {minX: 0 , minY: 0 , maxX: this.width, maxY: this.height};
}


SvgRenderer.prototype = {
    elements : [],
    frames: [],
    sequentialFrames : [],
    parallelFrames : [],
    parentThis: undefined,

    init: function() {
        parentThis = this;
    },

    addGroup: function() {
        var group = this.canvas.group();
        group.dragmove = this._elementOnDrag;
        group.dragend = this._elementOnStopDrag;
        group.dragstart = this._elementOnStartDrag;
        group.childSet = this.canvas.set();
        group.addChild = this._addChild;
        group.removeChild = this._removeChild;
        group.getChildren = this._getChildren;
        group.parentObject = null;

        return group;
    },


    addTerminalState: function(pos, name, args, colour) {
        if (colour === undefined) colour = '#110066';
        if (name === undefined) name = "tempname";
        if (args === undefined) args = [{name: 'bob'}, {name: 'bill'}];

        var input_height = args.length*30;

        var group = this.addGroup();
        var rect = this.canvas.rect(100, 50 + input_height).attr({ fill: colour, 'fill-opacity': 0.6, stroke: '#001', 'stroke-width': 4});
        var fobj = this.canvas.foreignObject(100, input_height).attr({id:'fobj_'+name}).move(0,30);

        for (var i = args.length - 1; i >= 0; i--) {
            arg = args[i];
            fobj.appendChild("input", {id: arg.name, size:10, value:arg.name});

        };
        var text = this.canvas.text(function(add) {
        add.tspan(name).newLine()}).move(10, 10);

        var groupHandle = this.canvas.group();
        groupHandle.add(rect);
        groupHandle.add(text);
        group.add(groupHandle);
        group.add(fobj);
        group.draggable(this.areaConstaint, groupHandle);

        var bbox = group.bbox();
        group.snapPoints = [{x:bbox.x, y:bbox.y2, child:null}];

        group.move(pos[0], pos[1]);
        this.elements.push(group);
    },

    addParallelFrame: function (pos, colour) {
        if (colour === undefined) colour = '#ff0011';

        var frame = new SvgRenderer.ParallelFrame(this.canvas);
        frame.plotPoly();
        frame.setPolyAttrs({ fill: colour, 'fill-opacity': 0.8, stroke: '#000', 'stroke-width': 7});
        frame.svgGroup.move(pos[0], pos[1]);
    },

    addFrame: function(pos, colour) {
        if (colour === undefined) colour = '#ff0011';

        var group = this.addGroup();
        var frame = this.canvas.polygon();
        var points = [[0,0], [120,0], [120,30], [30,30], [30, 120], [120, 120], [120, 145],  [0, 145]];
        frame.points = points;
        frame.plot(points);
        frame.attr({ fill: colour, 'fill-opacity': 0.8, stroke: '#000', 'stroke-width': 7});
        group.add(frame)
        group.draggable(this.areaConstaint);
        group.snapPoints = [{x:35, y:35, child:null}, {x:300, y:35, child:null}];

        group.onAddChild = function(child) {
            this.resizeToChildren();
        }

        group.resizeToChildren = function() {
            var child_set = this.getChildren();
            var box = child_set.bbox();

            var points = this.children()[0].array;
            points.value[1][0] = 30+ box.width + 100;
            points.value[2][0] = 30+ box.width + 100;
            points.value[4][1] = 40+ box.height;
            points.value[5][1] = 40+ box.height;
            points.value[6][1] = 55+ box.height;
            points.value[7][1] = 55+ box.height;

            this.children()[0].animate(3000).plot(points);
        }


        this.elements.push(group);
        this.parallelFrames.push(group);
        return group;
    },

    _groupSnap: function(child) {
        for (var i = parentThis.elements.length - 1; i >= 0; i--) {
            var element = parentThis.elements[i];
            if (element !== child) {
                for (var j = element.snapPoints.length - 1; j >= 0; j--) {
                    snapPoint = element.snapPoints[j];
                    if (snapPoint.child === null) {
                        var dist = Math.sqrt(Math.pow(child.x()-(snapPoint.x+element.x()), 2) + Math.pow(child.y()-(snapPoint.y+element.y()), 2));
                        if (dist < parentThis.snapDistance) {
                            var dx = (snapPoint.x+element.x())-child.x();
                            var dy = (snapPoint.y+element.y())-child.y();
                            child.dmove(dx, dy);
                            return {parent: element, node: snapPoint};
                        }
                        else {
                        }
                    }
                }
            }
        }

        return null;
    },



    _removeChild: function(child) {
        this.childSet.remove(child);


        //hack for now
        for (var i = parentThis.parallelFrames.length - 1; i >= 0; i--) {
            var frame = parentThis.parallelFrames[i];
            frame.resizeToChildren();
        };


        //call back specific object if defined
        if (this.onRemoveChild !== undefined) {
            this.onRemoveChild(child);
        }

    },


    _addChild: function(child) {
        this.childSet.add(child);


        //hack for now
        for (var i = parentThis.parallelFrames.length - 1; i >= 0; i--) {
            var frame = parentThis.parallelFrames[i];
            frame.resizeToChildren();
        };

        //call back specific object if defined
        if (this.onAddChild !== undefined) {
            this.onAddChild(child);
        }

    },

    _getChildren: function(complete_childset) {
        if (complete_childset === undefined) complete_childset = parentThis.canvas.set();

        this.childSet.each(function(i) {
            complete_childset.add(this);
            this.getChildren(complete_childset);
        });

        return complete_childset;
    },


    _getSnapChildren: function(parent, childSet) {
        if (childSet === undefined) childSet = parentThis.canvas.set();

        for (var i = parent.snapPoints.length - 1; i >= 0; i--) {
            var snapePoint = parent.snapPoints[i];
            var child = snapePoint.child;
            if (child !== null) {
                childSet.add(child);
                parentThis._getSnapChildren(child, childSet);
            }
        }

        return childSet;
    },

    _elementOnDrag: function(delta, event) {

        this.remember('snap_parent', parentThis._groupSnap(this));
        var child_set = this.getChildren();
        var parent_pos = {x:this.x(), y:this.y()};
        child_set.each(function(i) {
            var offset = this.remember('parent_offset');
            this.move(parent_pos.x + offset.x, parent_pos.y + offset.y);
        });
    },

    _elementOnStartDrag: function(delta, event) {
        var child_set = this.getChildren();
        var parent_pos = {x:this.x(), y:this.y()};
        this.front();
        this.remember('snap_parent', null);
        child_set.each(function(i) {
            this.remember('parent_offset', {x: this.x()-parent_pos.x, y:this.y()-parent_pos.y});
            this.front();
        });
    },

    _elementOnStopDrag: function(delta, event) {
        if (this.remember('snap_parent') !== null){
            //this.remember('snap_parent').node.child = this;
            this.parentObject = this.remember('snap_parent').parent;
            this.parentObject.addChild(this);
        }
        else
        {
            if (this.parentObject !== null){
                this.parentObject.removeChild(this);
                this.parentObject = null;
            }
        }

        this.forget('snap_parent');
    },


}


SvgRenderer.ParallelFrame = function(svg_canvas) {
    this.parentSvg = svg_canvas;
    this.svgGroup = svg_canvas.group();
    this.svgPolygon = svg_canvas.polygon();
    this.svgGroup.add(this.svgPolygon);
    this.svgGroup.draggable();
    this.headerHeight = 30;
    this.childSpacing = 40;

    //this = Object.create(svg_canvas.group());
}


SvgRenderer.ParallelFrame.prototype = {
        children: [],
        parentSvg: null,
        svgGroup: null,
        svgPolygon: null,
        headerHeight: 30,
        childSpacing: 40,
        points : [[0,0], [120,0], [120,30], [30,30], [30, 120], [120, 120], [120, 145],  [0, 145]],


        setPolyAttrs: function(attrs) {
            this.svgPolygon.attr(attrs);
        },

        plotPoly : function(points) {
            if (points === undefined) points = this.points;
            this.svgPolygon.plot(points);
        },

        getSnapPoints : function() {
            var points = [];
            var max_y = 0, max_x = 0;
            for (var i = 0; i < this.children.length; i++) {
                var child = this.children[i];
                max_y = this.y();
                max_x = this.x();
                points.push({x: this.x(), y:this.y(), parent: this, number: i});
            }
            //add extra empty point at the end
            points.push({x: max_x + this.childSpacing, y: this.headerHeight, parent: parent, number: i});
        },

        addChild : function(snap_no, child) {
            //New child at the end
            if (snap_no >= this.children.length) {
                this.children.push(child);
            }
            //move existing child at this location to the end
            else {
                var temp = this.children[snap_no];
                this.children[snap_no] = child;
                this.children.push(temp);
            }
        },

        removeChild : function(child) {
            var index = this.children.indexOf(child);
            this.children.splice(index, 1);
        },

        resizeToChildren : function() {
            var set = this.parentSvg.set();
            for (var i = this.children.length - 1; i >= 0; i--) {
                set.add(this.children[i]);
            };
            var box = set.bbox();


        }
}

