

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
    serialFrames : [],
    parallelFrames : [],
    parentThis: undefined,
    snapPoints: [],

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

        var frame = new SvgRenderer.ParallelFrame;
        frame.init();
        this.canvas.add(frame);
        frame.plotPoly();
        frame.setPolyAttrs({ fill: colour, 'fill-opacity': 0.8, stroke: '#000', 'stroke-width': 7});
        frame.initDraggable(frame.svgPolygon);
        frame.move(pos[0], pos[1]);
        frame.dragmove = this._elementOnDrag;
        frame.dragend = this._elementOnStopDrag;
        frame.beforedrag = this._elementOnStartDrag;
        this.parallelFrames.push(frame);

        return frame;
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
        for (var i = 0; i < this.snapPoints.length; i++) {
            var snapPoint = this.snapPoints[i];
            if (snapPoint.parent !== child)
            {
                var dist = Math.sqrt(Math.pow(child.x()-snapPoint.x, 2) + Math.pow(child.y()-snapPoint.y, 2));
                if (dist < parentThis.snapDistance) {
                    var dx = (snapPoint.x)-child.x();
                    var dy = (snapPoint.y)-child.y();
                    child.dmove(dx, dy);
                    return snapPoint;
                }
                else {
                }
            }
        }
        return undefined;
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
        this.remember('snapPoint', parentThis._groupSnap(this));
    },

    _elementOnStartDrag: function(delta, event) {
        this.front();
        //do group disconnection, this elememt should now be on the top level
        if (this.parent.removeChild !== undefined) {
            this.parent.removeChild(this, parentThis.canvas);
        }
        //get the possible snap points
        parentThis.updateSnapPoints();
        
    },

    _elementOnStopDrag: function(delta, event) {
        if (this.remember('snapPoint') !== undefined){
            var p = this.remember('snapPoint');
            p.parent.addChild(this, p.number);
        }
        else
        {
        }

        for (var i = 0; i < parentThis.snapPoints.length; i++) {
            var p = parentThis.snapPoints[i];
            p.marker.remove();
        };
        this.forget('snapPoint');
    },

    updateSnapPoints: function() {
        this.snapPoints = [];
        for (var i = 0; i < this.parallelFrames.length; i++) {
            var frame = this.parallelFrames[i];
            this.snapPoints = this.snapPoints.concat(frame.getSnapPoints());
        }

        for (var i = 0; i < this.serialFrames.length; i++) {
            var frame = this.serialFrames[i];
            this.snapPoints = this.snapPoints.concat(frame.getSnapPoints());
        }

        for (var i = 0; i < this.snapPoints.length; i++) {
            var p = this.snapPoints[i];
            p.marker = this.canvas.circle(20).fill("#00ff00").move(p.x,p.y);
        };
    }
}


// Parent Object for all Frame Types
SvgRenderer.GenericFrame = SVG.invent({
    create: 'g',
    inherit: SVG.G,
    extend: 
    {
        initDraggable: function(drag_handle) {
            this.draggable({}, drag_handle);
        },

        addChild : function(child, snap_no) {
            //New child at the end
            if (snap_no === undefined || snap_no >= this.childNodes.length) {
                this.childNodes.push(child);
            }
            //move existing child at this location to the end
            else {
                var temp = this.childNodes[snap_no];
                this.childNodes[snap_no] = child;
                this.childNodes.push(temp);
            }
                //the child will now be relative to this group, so needs a change of coord systems
                var pos = this.absPos()
                child.dmove(-pos.x, -pos.y);
                this.add(child);
                this.update();
        },

        removeChild : function(child, new_container) {
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
            this.update();
        },

        getChildSet : function() {
            var set = this.parent.set();
            for (var i = this.childNodes.length - 1; i >= 0; i--) {
                set.add(this.childNodes[i]);
            };

            return set;
        },



        absPos : function() {
            var t = this.rbox();
            return {x:t.x, y:t.y};
        },

        update : function() {
            var obj = this;
            do {
                obj.reorderChildren();
                obj.resizeToChildren();
                obj = obj.parent;
            } while (obj.resizeToChildren !== undefined);
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
            this.childNodes= [];
            this.parentSvg= null;
            this.svgGroup= null;
            this.svgPolygon= null;
            this.dragHandle= null;
            this.headerHeight= 30;
            this.childSpacing= 40;
            this.childStart= {x:30, y: 30};
            this.points= new SVG.PointArray([[0,0], [120,0], [120,30], [30,30], [30, 120], [120, 120], [120, 145],  [0, 145]]);
        },

        setPolyAttrs: function(attrs) {
            if (this.svgPolygon !== null) {
                this.svgPolygon.attr(attrs);
            }
        },

        plotPoly : function(points) {
            if (points === undefined) points = this.points;
            if (this.svgPolygon === null) 
            {
                this.svgPolygon = this.put(new SVG.Polygon);
            }
            this.svgPolygon.plot(points);
        },

        getSnapPoints : function() {
            var points = [];
            var absPos = this.absPos();
            var max_y = absPos.y + this.childStart.y, max_x = absPos.x + this.childStart.x;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                points.push({x: absPos.x + child.x(), y: absPos.y + child.y(), parent: this, number: i});
                max_y = absPos.y + child.y() + child.bbox().height;
                max_x = absPos.x + child.x() + child.bbox().width;
            }

            //add extra empty point at the end
            points.push({x: max_x + this.childSpacing, y: absPos.y + this.childStart.y, parent: this, number: i});

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

        resizeToChildren : function() {
            var set = this.getChildSet();
            var box = set.bbox();
            var points = this.points;
            points.value[1][0] = 30 + box.width + 100;
            points.value[2][0] = 30 + box.width + 100;
            points.value[4][1] = 40 + box.height;
            points.value[5][1] = 40 + box.height;
            points.value[6][1] = 55 + box.height;
            points.value[7][1] = 55 + box.height;

            this.plotPoly(points);
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
            this.parentSvg= null;
            this.svgGroup= null;
            this.svgPolygon= null;
            this.dragHandle= null;
            this.headerHeight= 30;
            this.childSpacing= 20;
            this.childStart= {x:30, y: 0};
            this.points= new SVG.PointArray([[0,0], [120,0], [120,30], [30,30], [30, 120], [120, 120], [120, 145],  [0, 145]]);
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
            var max_y = this.y() + this.childStart.y, max_x = this.x() + this.childStart.x;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                points.push({x: this.x() + child.x(), y: this.y() + child.y(), parent: this, number: i});
                max_y = this.y() + child.y() + child.bbox().height;
                max_x = this.x() + child.x() + child.bbox().width;
            }
            //add extra empty point at the end
            points.push({x: this.x() + this.childStart.x, y: max_y + this.childSpacing, parent: this, number: i});

            return points;
        },

        reorderChildren : function() {
            var y_count = this.childStart.y;
            for (var i = 0; i < this.childNodes.length; i++) {
                var child = this.childNodes[i];
                child.move(0, y_count);
                y_count += child.bbox().height + this.childSpacing;
            };
        },

        resizeToChildren : function() {
            var set = this.getChildSet();
            var box = set.bbox();
            var points = this.points;
            points.value[1][0] = 30 + box.width + 100;
            points.value[2][0] = 30 + box.width + 100;
            points.value[4][1] = 40 + box.height;
            points.value[5][1] = 40 + box.height;
            points.value[6][1] = 55 + box.height;
            points.value[7][1] = 55 + box.height;

            this.plotPoly(points);
        }
    }
})






