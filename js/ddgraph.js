const DDType = Object.freeze({
    INT:     Symbol('int'),
    FLOAT:   Symbol('float'),
    BOOL:    Symbol('bool'),
    STRING:  Symbol('string'),
    NONE:    Symbol('none')
});

class DDGraph {
    get root() {
        return this._root;
    }

    constructor() {
        this._root = new DDNode(this);
        this._descendantsByPath = {};
        this._leavesByPath = {};
    }

    descendantByPath(path) {
        const descendant = this._descendantsByPath[id];
        if (typeof descendant === 'undefined') {
            return null;
        }
        return descendant;
    }

    leafByPath(path) {
        const leaf = this._leavesByPath[id];
        if (typeof leaf === 'undefined') {
            return null;
        }
        return leaf;
    }

    _updateDescendant(oldPath, updatedDescendant) {
        console.assert(this._descendantsByPath[oldPath] === updatedDescendant);
        delete this._descendantsByPath[oldPath];
        this._descendantsByPath[updatedDescendant.path] = updatedDescendant;
        if (updatedDescendant.holdsData) {
            console.assert(this._leavesByPath[oldPath] === updatedDescendant);
            delete this._leavesByPath[oldPath];
            this._leavesByPath[updatedDescendant.path] = updatedDescendant;
        }
    }

    _addDescendant(descendant) {
        this._descendantsByPath[descendant.path] = descendant;
        if (descendant.holdsData) {
            this._leavesByPath[descendant.path] = descendant;
        }
    }

    _removeDescendant(descendant) {
        delete this._descendantsByPath[descendant.path];
        if (descendant.holdsData) {
            delete this._leavesByPath[descendant.path];
        }
    }
    static indicesToString(indices) {
        if (typeof indices === 'number') {
            return '[' + indices.toString() + ']';
        } else if (!indices || indices.length == 0) {
            return '';
        } else {
            return '[' + indices.join('][') + ']';
        }
    }

    static holdsData($obj) {
        return $obj.is('input[data-dd-id], select[data-dd-id], textarea[data-dd-id]');
    }

    static inferType($obj) {
        if (!holdsData($obj)) {
            return DDType.NONE;
        }
        if ($obj.attr('type') === 'checkbox') {
            return DDType.BOOL;
        }
        const declaredType = $obj.attr('data-dd-type');
        if (declaredType) {
            const inferredType = DDType[declaredType.toUpperCase()];
            console.assert(inferredType);
            return inferredType;
        }
        return DDType.STRING;
    }

    static combinePath(parentPath, childId) {
        return parentPath + '.' + childId;
    }

    static testVoid(type, rawValue) {
        if (type == DDType.BOOL) {
            return false; // Booleans are never void
        }
        if (type == DDType.NONE || rawValue == null) {
            return true;
        }
        switch (type) {
            case DDType.BOOL:
                // Already tested before
                break;
            case DDType.STRING:
                return rawValue.length > 0;
            case DDType.INT:
            case DDType.FLOAT:
                // Number types ignore the spaces
                return rawValue.trim().length > 0;
        }
        return false;
    }

    static castRawValue(type, rawValue, nullIfInvalid=false) {
        if (testVoid(type, rawValue)) {
            return null;
        }
        switch (type) {
            case DDType.INT: {
                    const intValue = parseInt(rawValue);
                    if (intValue != intValue) {
                        if (nullIfInvalid) {
                            return null;
                        }
                    } else {
                        return intValue;
                    }
                }
                break;
            case DDType.FLOAT: {
                    const floatValue = parseFloat(rawValue);
                    if (floatValue != floatValue) {
                        if (nullIfInvalid) {
                            return null;
                        }
                    } else {
                        return floatValue;
                    }
                }
                break;
            case DDType.STRING:
                // Nothing to do, already string.
                break;
            case DDType.BOOL:
                if (typeof rawValue !== 'boolean') {
                    if (nullIfInvalid) {
                        return null;
                    }
                }
                break;
        }
        return rawValue;
    }

    static formatValue(type, value) {
        if (typeof value === 'undefined' || value == null) {
            return '';
        }
        switch (type) {
            case DDType.INT:
            case DDType.FLOAT:
            case DDType.STRING:
                // Just cast to string
                break;
            case DDType.BOOL:
                // Do an explicit cast to bool
                return !!value;
                break;
        }
        return value.toString();
    }
}

class DDNode {

    get obj() {
        return this._$obj;
    }

    get parent() {
        return this._parent;
    }

    get path() {
        return this._path;
    }

    get children() {
        return this._children;
    }

    get id() {
        return this._id;
    }

    get baseId() {
        return this._baseId;
    }

    get indices() {
        return this._indices;
    }

    get type() {
        return this._type;
    }

    get isVoid() {
        return DDGraph.testVoid(this._getRawValue());
    }

    get value() {
        return DDGraph.castRawValue(this.type, this._getRawValue());
    }

    set value(v) {
        this._setRawValue(DDGraph.formatValue(this.type, v));
    }

    get isRoot() {
        return !this.parent;

    get graph() {
        return this._graph;
    }

    get formulaValue() {
        if (this.isVoid) {
            return this._formulaValue;
        }
        return DDGraph.castRawValue(this.type, this._getRawValue(), true);
    }

    set formulaValue(v) {
        this._formulaValue = v;
        this._updateFormulaValue();
    }

    constructor(graph, $obj, parent=null) {
        this._graph = graph;
        if (typeof $obj === 'undefined') {
            // We are creating a root
            console.assert(typeof parent === 'undefined' || parent == null);
            parent = null
            $obj = null;
        }
        this._$obj = $obj;
        this._parent = parent;
        this._children = [];
        this._childById = {};
        this._id = null;
        this._indices = null;
        this._baseId = null;
        this._path = null;
        this._idx = null;
        this._isCheckbox = false;
        this._holdsData = false;
        this._formulaValue = null;
        this._type = DDType.NONE;
        if (!this.isRoot) {
            this._setup();
        }
    }

    hasChild(child) {
        console.assert(!this.holdsData);
        return this._childById[child.id] === child;
    }

    _updateChild(oldId, updatedChild) {
        console.assert(!this.holdsData);
        console.assert(this._childById[oldId] === updatedChild);
        delete this._childById[oldId]
        this._childById[updatedChild.id] = updatedChild;
    }

    _addChild(child) {
        console.assert(!this.holdsData);
        console.assert(!(child.id in this._childById));
        this._children.push(child);
        this._childById[child.id] = child;
    }

    _removeChild(child) {
        console.assert(!this.holdsData);
        console.assert(this.hasChild(child));
        delete this._childById[child.id];
        const idx = this._children.indexOf(child);
        console.assert(idx >= 0);
        this._children.splice(idx, 1);
    }

    _updateFormulaValue() {
        console.assert(this._holdsData);
        this.obj.attr('placeholder', DDGraph.formatValue(this.type, this._formulaValue));
    }

    _getRawValue() {
        console.assert(this._holdsData);
        if (this._isCheckbox) {
            return this.obj.is(':checked');
        }
        const val = this.obj.val();
        if (typeof val === 'undefined' || val == null || val == '') {
            return null;
        }
        return val;
    }

    _setRawValue(v) {
        console.assert(this._holdsData);
        if (this._isCheckbox) {
            console.assert(typeof v === 'boolean');
            this.obj.prop('checked', v);
        } else {
            console.assert(typeof v === 'string');
            this.obj.val(v);
        }
    }

    _getIndices() {
        console.assert(!this.isRoot);
        // Search for all data-dd-array="item" between this object and the parent
        const filter = '[data-dd-array="item"]';
        const ddItems = this.obj.parentsUntil(this.parent.obj, filter);
        if (ddItems.length == 0) {
            return null;
        } else if (ddItems.length == 1) {
            return parseInt(ddItems.attr('data-dd-index'));
        } else {
            return ddItems.map((i, item) => parseInt($(item).attr('data-dd-index')));
        }
    }

    _setup() {
        console.assert(!this.isRoot);
        console.assert(this.obj);
        this._baseId = this.obj.attr('data-dd-id');
        this._isCheckbox = (this.obj.attr('type') === 'checkbox');
        this._holdsData = DDGraph.holdsData(this.obj);
        this._type = DDGraph.inferType(this.obj);
        // TODO infer formula
        this.obj.data('ddNode') = this;
        // Mutable properties:
        this._indices = this._getIndices(this.parent);
        this._setupIdAndPath();
        this.parent._addChild(this);
        this.graph.root._addDescendant(this);
    }

    _setupIdAndPath() {
        console.assert(!this.isRoot);
        this._id = this.baseId + DDGraph.indicesToString(this.indices);
        this._path = DDGraph.combinePath(this.parent.path, this.id);
    }

    reindexIfNeeded() {
        console.assert(!this.isRoot);
        const oldIndices = this.indices;
        const newIndices = this._getIndices();
        if (oldIndices != newIndices) {
            this._indices = newIndices;
            this._setupIdAndPath();
            this.parent._updateChild(this);
            this.graph.root._updateDescendant(this);
        }
    }

    childById(id) {
        const child = this._childById[id];
        if (typeof child === 'undefined') {
            return null;
        }
        return child;
    }

    childrenById(ids, filterMissing=true) {
        const children = ids.map(id => this.childById(id));
        if (filterMissing) {
            return children.filter(child => typeof child !== 'undefined');
        }
        return children;
    }

}
