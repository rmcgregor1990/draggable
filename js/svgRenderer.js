function SvgRenderer(svg_element) {
    this.canvas = SVG(svg_element);
    this.snapDistance = 30;
    this.init();
}

SvgRenderer.prototype = {
    elements : [],
    parentThis: undefined,

    init: function() {
        parentThis = this;
    },

    addElement: function(pos, colour) {
        if (colour === undefined) colour = '#0000ff';
        var group = this.canvas.group()
        var rect = this.canvas.rect(100, 50).attr({fill: colour, stoke: '#001', 'stroke-width': 2});

        var fobj = this.canvas.foreignObject(100,30).attr({id:'fobj'});
        fobj.appendChild("input", {id: 'input', size:10, value:this.elements.length});
        group.add(rect);
        group.add(fobj);
        group.draggable({}, rect);
        group.dragmove = this._elementOnDrag;
        group.dragend = this._elementOnStopDrag;
        group.dragstart = this._elementOnStartDrag;
        var bbox = group.bbox();

        group.snapPoints = [{x:bbox.x, y:bbox.y2, child:null}];

        group.parentGroup = null;
        group.childGroup = null;

        group.move(pos[0], pos[1]);
        this.elements.push(group);
    },

    addFrame: function(pos, colour) {
        if (colour === undefined) colour = '#ff0011';

        var frame = this.canvas.polygon().fill('none').stroke({ width: 1 });
        var points = new SVG.PointArray([[0,0], [120,0], [120,30], [30,30], [30, 120], [0, 120]]);
        frame.plot(points);
        frame.attr({ fill: colour, 'fill-opacity': 0.8, stroke: '#000', 'stroke-width': 10});
        frame.draggable();
        frame.dragmove = this._elementOnDrag;
        frame.dragend = this._elementOnStopDrag;
        frame.dragstart = this._elementOnStartDrag;
        frame.snapPoints = [{x:50, y:35, child:null}];

        frame.extend = function(direction) {
            var points = new SVG.PointArray(this.array);
            points.value[1][0] += direction[0];
            points.value[2][0] += direction[0];
            points.value[4][1] += direction[1];
            points.value[5][1] += direction[1];

            this.animate(3000).plot([[0,0], [120,0], [120,30], [30,37], [300, 120], [0, 120]]);
        }
        this.elements.push(frame);
        return frame;
    },

    _groupSnap: function(child) {
        for (var i = parentThis.elements.length - 1; i >= 0; i--) {
            var element = parentThis.elements[i];
            if (element !== child) {
                for (var j = element.snapPoints.length - 1; j >= 0; j--) {
                    snapPoint = element.snapPoints[j];
                    if (snapPoint.child === null || snapPoint.child === child) {
                        var dist = Math.sqrt(Math.pow(child.x()-(snapPoint.x+element.x()), 2) + Math.pow(child.y()-(snapPoint.y+element.y()), 2));
                        if (dist < parentThis.snapDistance) {
                            var child_set = parentThis._getSnapChildren(child);
                            child_set.add(child);
                            var dx = (snapPoint.x+element.x())-child.x();
                            var dy = (snapPoint.y+element.y())-child.y();
                            child_set.dmove(dx, dy);
                            snapPoint.child = child;
                            return element;
                        }
                        else {
                            snapPoint.child = null;
                        }
                    }    
                }
            }
        }

        return null;
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

        parentThis._groupSnap(this);
        var child_set = parentThis._getSnapChildren(this);
        var parent_pos = {x:this.x(), y:this.y()};    
        child_set.each(function(i) {
            var offset = this.remember('parent_offset');
            this.move(parent_pos.x + offset.x, parent_pos.y + offset.y);
        });
    },

    _elementOnStartDrag: function(delta, event) {
        var child_set = parentThis._getSnapChildren(this);
        var parent_pos = {x:this.x(), y:this.y()};    
        this.front(); 
        child_set.each(function(i) {
            this.remember('parent_offset', {x: this.x()-parent_pos.x, y:this.y()-parent_pos.y});
            this.front();
        });
    },

    _elementOnStopDrag: function(delta, event) {

    }
}
