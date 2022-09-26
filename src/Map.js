import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import Xarrow, { useXarrow, Xwrapper } from "react-xarrows";
import { XMLParser } from 'fast-xml-parser';
import hints from './Map.hints';

const boxStyle = {border: '#888 solid 2px', padding: '5px', maxWidth: '100px', backgroundColor: '#6f42c1', color: 'white', zIndex: 2, position: 'absolute'};

const DraggableBox = ({id, text, x, y}) => {
    const nodeRef = useRef(null);
    const updateXarrow = useXarrow();
    return (
        <Draggable nodeRef={nodeRef} onDrag={updateXarrow} onStop={updateXarrow}>
            <div id={id} ref={nodeRef} style={{...boxStyle, top: y+'px', left: x+'px'}}>
                {text}
            </div>
        </Draggable>
    );
};

const Arrow = (from, to, color, showTail, zIndex) => {
    return (
        <Xarrow key={from + "_" + to}
            start={from.toString()}
            end={to.toString()}
            color={color}
            showHead={true}
            showTail={showTail}
            headSize={3}
            tailSize={3}
            zIndex={zIndex}
            path="grid"/>
    );
}

class GridBase {
    constructor() {
        this.map = [];
        this.placed = new Set();
    }

    width() {
        return (this.map[0] && this.map[0].length) || 0;
    }

    height() {
        return this.map.length;
    }

    rows() {
        const r = [];
        for (let i = 0; i < this.map.length; i++) {
            r.push(i);
        }
        return r;
    }

    findNode(y,i) {
        let c = 0;
        for (let x = 0; x < this.map[y].length; x++) {
            if (this.map[y][x] !== null) {
                if (c === i) {
                    return this.map[y][x];
                }
                c += 1;
            }
        }
        return undefined;
    }

    nodesInRow(y) {
        let c = 0;
        for (let x = 0; x < this.map[y].length; x++) {
            if (this.map[y][x] !== null) {
                c += 1;
            }
        }
        return c;
    }

    findPos(id) {
        let pos = undefined;
        if (!this.placed.has(id)) {
            return pos;
        }
        this.map.forEach((l,y) => l.forEach((c,x) => {
            if (c === id) {
                pos = [y, x];
            }
        }));
        return pos;
    }

    hasNode(id) {
        return this.placed.has(id);
    }

    print() {
        const mlen = Math.max(...this.map.flatMap(l => l.map(i => i === null ? 0 : i.toString().length)));
        const grid = this.map.map(l =>
            l.map(i => i === null ? "".padStart(mlen, " ") : i.toString().padStart(mlen - i.toString().length, " ")).join(" ")
        ).join("\n");
        console.log(grid);
    }

    forEach(fun) {
        this.forEachRow(y => this.forEachOnRow(y, fun))
    }

    forEachRow(fun) {
        for (let y = 0; y < this.map.length; y++) {
            fun(y, this.map[y])
        }
    }

    forEachOnRow(y, fun) {
        for (let x = 0; x < this.map[y].length; x++) {
            if (this.map[y][x] !== null) {
                fun(this.map[y][x], y, x);
            }
        }
    }

    copy(grid) {
        this.map = new Array(grid.map.length)
        for (let i = 0; i < this.map.length; i++) {
            this.map[i] = [...grid.map[i]];
        }
        this.placed.clear()
        this.forEach(i => this.placed.add(i))
    }

    insertHRow(y) {
        this.map.splice(y, 0, new Array(this.width()).fill(null));
    }

    insertVRow(x) {
        this.forEachRow((y,row) => row.splice(x, 0, null))
    }

    get(p) {
        return this.map[p[0]][p[1]]
    }

    isWithinY(p) {
        return 0 <= p[0] && p[0] < this.map.length
    }

    isWithinX(p) {
        return 0 <= p[1] && this.map[p[0]] && p[1] < this.map[p[0]].length
    }

    isWithin(p) {
        return this.isWithinY(p) && this.isWithinX(p)
    }

    set(p, v) {
        if (this.map[p[0]][p[1]]) {
            this.placed.delete(this.map[p[0]][p[1]])
        }
        this.map[p[0]][p[1]] = v
        this.placed.add(v)
    }

    up(p) {
        return [p[0]-1,p[1]]
    }

    down(p) {
        return [p[0]+1,p[1]]
    }

    right(p) {
        return [p[0],p[1]+1]
    }

    left(p) {
        return [p[0],p[1]-1]
    }
}

class SectionGrid extends GridBase {
    constructor(id, hint){
        super();
        this.id = id;
        this.hint = hint;
    }

    gridXY(nodeWidth, nodeHeight) {
        const coord = new Map();
        this.forEach((id, y, x) => coord.set(id, [y*nodeHeight,x*nodeWidth]));
        return coord;
    }

    isLadder(from, to, dir) {
        return dir.includes('ladder')
    }

    isNorth(from, to, dir) {
        return dir === 'north' || dir === 'up'
    }

    isSouth(from, to, dir) {
        return dir === 'south' || dir === 'down'
    }

    isEast(from, to, dir) {
        return dir === 'east'
    }

    isWest(from, to, dir) {
        return dir === 'west'
    }

    isAnyDirection(from, to, dir) {
        return dir === '*'
    }

    insertRoom(from, to, pos, dir) {
        this.hint.fixDirection && this.hint.fixDirection
            .forEach(f => {
                if (f.from === from && f.to === to) {
                    dir = f.dir;
                }
            });
        // console.log('Inserting room ' + from + ' -> ' + to + ' ' + pos + ' ' + dir)
        let tpos
        if (dir) {
            if (this.isLadder(from, to, dir)) {
                dir = 'up';
                // if ladder is not going up then it's going down
                if (this.get(this.up(pos))) {
                    dir = 'down';
                }
            }
            if (this.isNorth(from, to, dir)) {
                const ipos = this.up(pos)
                tpos = [ipos, this.left(ipos), this.right(ipos)]
            } else if (this.isSouth(from, to, dir)) {
                const ipos = this.down(pos)
                tpos = [ipos, this.left(ipos), this.right(ipos)]
            } else if (this.isEast(from, to, dir)) {
                const ipos = this.right(pos)
                tpos = [ipos, this.up(ipos), this.down(ipos)]
            } else if (this.isWest(from, to, dir)) {
                const ipos = this.left(pos)
                tpos = [ipos, this.up(ipos), this.down(ipos)]
            } else if (this.isAnyDirection(from, to, dir)) {
                tpos = [this.up(pos), this.down(pos), this.left(pos), this.right(pos)]
            } else {
                console.log('Error, unknown direction, couldnt place room: ' + from + ' -> ' + to + ' ' + dir)
                return;
            }
        } else {
            tpos = [pos]
        }
        // console.log(tpos)
        for (let i = 0; i < tpos.length; i++) {
            const ipos = tpos[i]
            if (this.isWithin(ipos)) {
                if (this.get(ipos) === null) {
                    this.set(ipos,to)
                    return;
                }
            } else {
                // console.log(ipos);
                if (this.isWithinX(ipos)) {
                    // console.log('inserting hrow')
                    if (ipos[0] === -1) {
                        ipos[0] = 0
                    }
                    this.insertHRow(ipos[0])
                    this.set(ipos,to)
                } else if (this.isWithinY(ipos)) {
                    // console.log('inserting vrow')
                    if (ipos[1] === -1) {
                        ipos[1] = 0
                    }
                    this.insertVRow(ipos[1])
                    this.set(ipos,to)
                } else {
                    // console.log('inserting both rows')
                    if (ipos[0] === -1) {
                        ipos[0] = 0
                    }
                    this.insertHRow(ipos[0])
                    if (!this.isWithinX(ipos)) {
                        if (ipos[1] === -1) {
                            ipos[1] = 0
                        }
                        this.insertVRow(ipos[1])
                    }
                    this.set(ipos,to)
                }
                return;
            }
        }
        console.log('Error, couldnt place room: ' + from + ' -> ' + to + ' ' + dir)
    }

}

class MapGrid extends SectionGrid {
    constructor(sections,hint) {
        super(0, hint);
        this.sections = sections;
        this.spaceX = 0;
        this.spaceY = 0;
        this.initMapGrid();
    }

    findSection(id) {
        return this.sections.find(sec => sec.id === id);
    }

    placeSections() {
        const rows = this.rows();
        const wh = rows.map(y => {
            let sw=0, sh=0;
            this.forEachOnRow(y, (id, y, x) => {
                const s = this.findSection(id);
                sw += s.width;
                sh = Math.max(s.height, sh);
            });
            return [sh,sw];
        });
        const maxw = Math.max(...wh.map(s => s[1]));
        let yp = 0;
        // this.print();
        // console.log(wh);
        rows.forEach(y => {
            const nodes = this.nodesInRow(y);
            // console.log(y);
            // console.log(nodes);
            let sec = this.findSection(this.findNode(y, 0));
            if (nodes === 1) {
                const space = (maxw - sec.width)/2;
                sec.setXY(this.spaceY + yp, this.spaceX + space);
            } else {
                const space = (maxw - wh[y][1])/(nodes-1);
                sec.setXY(this.spaceY + yp, this.spaceX);
                let xp = this.spaceX + sec.width;
                for (let i = 1; i < nodes; i++) {
                    sec = this.findSection(this.findNode(y,i));
                    xp += space + this.spaceX;
                    sec.setXY(this.spaceY + yp, xp);
                    xp += sec.width;
                }
            }
            yp += this.spaceY + wh[y][0];
        });
        // DEBUG only: hide only sections
        // this.sections.forEach(s => s.setHidden(![0,1,7].includes(s.id)));
        console.log(this.sections);
    }

    initMapGrid() {
        this.sections.forEach(s => {
            let pos = this.findPos(s.id) || [0, 0];
            // console.log(s.id);
            // console.log(s.adjExits);
            // console.log(s.width);
            // console.log(s.height);
            // s.map.print();
            if (!this.hasNode(s.id)) {
                this.insertSection(s.id, pos);
                pos = this.findPos(s.id);
            }
            s.adjExits.forEach((es,rid) => {
                es.forEach(et => {
                    let sid = et[0];
                    if (this.hasNode(sid)) {
                        return;
                    }
                    let e = et[1];
                    let dir = 'up';
                    if (e.name === 'down') {
                        dir = 'down';
                    }
                    let epos;
                    if (dir === 'up') {
                        epos = [pos[0] - 1, pos[1]];
                    } else {
                        epos = [pos[0] + 1, pos[1]];
                    }
                    this.insertSection(sid, epos, pos, dir);
                    pos = this.findPos(s.id);
                });
            });
        })
    }

    insertSection(id, pos, frompos, dir) {
        if (!this.map[pos[0]]) {
            if (pos[0] === -1) {
                pos[0] = 0;
            }
            this.map.splice(pos[0], 0, new Array(this.width()).fill(null));
        }
        if (this.map[pos[0]][pos[1]] === null) {
            this.map[pos[0]][pos[1]] = id;
        } else {
            if (pos[1] === -1) {
                pos[1] = 0;
            }
            this.map[pos[0]].splice(pos[1], 0, id);
            // this.map.forEach((l,y) => {
            //     if (y !== pos[0]) {
            //         l.splice(pos[1], 0, null);
            //     }
            // });
        }
        this.placed.add(id);
        // console.log(this.map);
        this.print();
    }
}


class Section {
    constructor(id, rooms, hint) {
        this.id = id;
        this.rooms = rooms;
        this.adjExits = new Map();
        this.x = 0;
        this.y = 0;
        this.nodeX = 150;
        this.nodeY = 75;
        this.hidden = false;
        this.hint = hint;
    }

    setHidden(hidden) {
        this.hidden = hidden;
    }

    setXY(y,x) {
        this.x = x;
        this.y = y;
        this.rooms.forEach(r => r.setXY(r.y + y, r.x + x));
    }

    initAdjSections(allSections) {
        this.rooms.forEach(r => {
            const adjExits = r.allExits().map(e => {
                const sec = allSections.find(sec => sec.id !== this.id && sec.containsRoom(e.target))
                if (sec) {
                    return [sec.id, e];
                }
                return null;
            }).filter(e => e !== null);
            if (adjExits.length > 0) {
                this.adjExits.set(r.id, adjExits);
            }
        });
    }

    findRoom(id) {
        return this.rooms.find(room => room.id === id);
    }

    containsRoom(id) {
        return this.rooms.find(r => id === r.id);
    }

    sectionMap() {
        console.log(this.rooms);
        const allRoomIds = new Set(this.rooms.map(r => r.id));
        const extraExitsRoomIds = new Set(this.rooms.flatMap(r => r.extraExits.map(e => e.target)).filter(id => allRoomIds.has(id)));
        this.map = new SectionGrid(this.id, this.hint);
        const insertExit = (r,e) => {
            if (allRoomIds.has(e.target) && !this.map.hasNode(e.target)) {
                const pos = this.map.findPos(r.id);
                this.map.insertRoom(r.id, e.target, pos, e.name);
            }
        }
        const insertRoom = r => {
            let pos = this.map.findPos(r.id) || [0, 0];
            const rexitIds = new Set(r.allExitIds())
            const possibleEntrance = this.rooms.filter(r => this.map.hasNode(r.id)).find(r => rexitIds.has(r.id))
            if (possibleEntrance) {
                pos = this.map.findPos(possibleEntrance.id)
                this.map.insertRoom(possibleEntrance.id, r.id, pos, '*');
            } else {
                this.map.insertRoom(undefined, r.id, pos);
            }
        }
        // insert rooms and n,s,w,e exits
        // console.log('inserting rooms and exits');
        this.rooms.filter(r => !extraExitsRoomIds.has(r.id)).forEach(r => {
            if (!this.map.hasNode(r.id)) {
                insertRoom(r)
            }
            r.exits.forEach(e => insertExit(r, e));
        });
        // insert extra rooms exits
        // console.log('inserting extra exits');
        this.rooms.filter(r => extraExitsRoomIds.has(r.id)).forEach(r => {
            if (!this.map.hasNode(r.id)) {
                insertRoom(r)
            }
            r.exits.forEach(e => insertExit(r, e));
            r.extraExits.forEach(e => insertExit(r, e));
        });
        // console.log(this.adjExits);
        this.map.print();
        const coordsMap = this.map.gridXY(this.nodeX,this.nodeY);
        this.rooms.forEach(r => {
            const xy = coordsMap.get(r.id);
            r.setXY(xy[0] + this.y, xy[1] + this.x);
        });
        this.width = this.nodeX * this.map.width();
        this.height = this.nodeY * this.map.height();
    }

    getArrows() {
        const arrows = new Map(this.rooms.map(r =>
            [r.id, r.exits.map(e => [r.id, e.target, false]).concat(r.extraExits.map(e => [r.id, e.target, false]))]
        ));
        arrows.forEach((exits, id) => {
            arrows.set(id, exits.map(e => {
                const adjExits = arrows.get(e[1]);
                if (adjExits) {
                    arrows.set(e[1], adjExits.filter(e2 => e2[1] !== e[0]));
                    return [e[0], e[1], true];
                }
                return e;
            }));
        });
        return arrows;
    }

    render() {
        if (this.hidden) {
            return [];
        }
        const rooms = this.rooms.map(r => r.render());
        const arrows = this.getArrows();
        const allRoomIds = this.rooms.map(r => r.id);
        const rarrows = this.rooms.flatMap(r => arrows.get(r.id).filter(e => allRoomIds.includes(e[1])).map(a =>
            Arrow(a[0], a[1], "#6f42c1", a[2], 1)
        ));
        return rooms.concat(rarrows);
    }
}

class Rooms {
    constructor(rooms, hint) {
        this.rooms = rooms;
        this.hint = hint;
        this.sections = []
        this.initSections();
        this.initMapGrid();
    }

    initMapGrid() {
        this.grid = new MapGrid(this.sections, this.hint);
        this.grid.placeSections();
    }

    initSections() {
        let start = this.hint.startRoom ? this.findRoom(this.hint.startRoom) : this.rooms[0];
        do {
            const section = [start];
            let rooms = section;
            do {
                rooms = rooms.map(room => this.roomExits(room.exits)).flatMap(room => room).filter(room => {
                    if (!section.find(r => r.id === room.id)) {
                        section.push(room);
                        return true;
                    }
                    return false;
                });
            } while(rooms.length !== 0);
            this.sections.push(section);
            const allSectionRooms = this.sections.reduce((acc, sec) => acc.concat(sec.map(r => r.id)), []);
            start = this.rooms.find(room => !allSectionRooms.includes(room.id));
        } while (start !== undefined);
        // compact sections
        this.sections = this.sections.map(section => {
            if (section.length === 1) {
                const room = section[0];
                const allExitIds = room.allExitIds();
                let adjSections = this.sections.filter(section =>
                    section.find(r => allExitIds.includes(r.id)) || section.find(r => r.containsExit(room.id))
                );
                if (adjSections.length > 1) {
                    const minLen = Math.min(...adjSections.map(sec => sec.length));
                    adjSections = [adjSections.find(sec => sec.length === minLen)];
                }
                if (adjSections.length === 1) {
                    adjSections[0].push(room);
                    return null;
                }
                return section;
            }
            return section;
        }).filter(section => section !== null);
        this.sections = this.sections.map((sec, ind) => new Section(ind, sec, this.hint));
        this.sections.forEach(sec => sec.initAdjSections(this.sections));
        this.sections.forEach(sec => sec.sectionMap());
        // console.log(this.sections);
    }

    findRoom(id) {
        return this.rooms.find(room => room.id === id);
    }

    findSection(id) {
        return this.sections.find(sec => sec.id === id);
    }

    roomExits(exits) {
        return exits.map(exit => this.findRoom(exit.target));
    }

    getArrows() {
        let arrows = this.sections.flatMap(s => {
            if (!s.hidden) {
                const result = [];
                s.adjExits.forEach((es,rid) => {
                    es.forEach(e => {
                        const ts = this.findSection(e[0]);
                        if (!ts.hidden) {
                            result.push([rid,e[1].target, false]);
                        }
                    });
                });
                return result;
            }
            return [];
        });
        const toRemove = [];
        arrows.forEach(a => {
            arrows.forEach(b => {
                if (a[1] === b[0] && b[1] === a[0]) {
                    if (!toRemove.find(i => i[0] === a[0] && i[1] === a[1])) {
                        a[2] = true;
                        toRemove.push(b);
                    }
                }
            })
        })
        return arrows.filter(a => toRemove.find(i => i[0] === a[0] && i[1] === a[1]) === undefined);
    }

    render() {
        return this.sections.map(sec => sec.render()).reduce((r1, r2) => r1.concat(r2)).concat(
            this.getArrows().map(a => Arrow(a[0], a[1], "#2cf4eb", a[2], 0))
        );
    }

}

class Room {
    constructor(id, name, sector) {
        this.id = id;
        this.name = name;
        this.sector = sector;
        this.exits = []
        this.extraExits = []
        this.x = 0;
        this.y = 0;
    }

    containsExit(id) {
        return (this.exits.find(e => e.target === id) || this.extraExits.find(e => e.target === id)) && true;
    }

    allExits() {
        return this.exits.concat(this.extraExits);
    }

    allExitIds() {
        return this.exits.map(r => r.target).concat(this.extraExits.map(r => r.target));
    }

    setExits(exits) {
        this.exits = exits;
    }

    setXY(y,x) {
        this.x = x;
        this.y = y;
    }

    setExtraExits(exits) {
        this.extraExits = this.extraExits.concat(exits);
        // Remove duplicate exits
        const roomIds = new Set(this.extraExits.map(exit => exit.target));
        if (roomIds.size !== this.extraExits.length) {
            roomIds.forEach(roomId => {
                const i = this.extraExits.findIndex(exit => exit.target === roomId);
                this.extraExits = this.extraExits.filter((exit, ind) => exit.target === roomId ? ind === i : true);
            })
        }
    }

    render() {
        return (<DraggableBox key={this.id} id={this.id.toString()} text={this.name} x={this.x} y={this.y}/>);
    }
}

export default class AreaMap extends React.Component {

    state = { name: null, rooms: null, activeRoom: null };

    constructor(props) {
        super(props);
        this.parseMap = this.parseMap.bind(this);
        this.fetchXml = this.fetchXml.bind(this);
        this.setActiveRoom = this.setActiveRoom.bind(this);
    }

    componentDidMount() {
        this.fetchXml('map/galeon.are.xml');
    }

    setActiveRoom(id) {
        if (this.state.activeRoom !== null) {
            const elem = document.getElementById(this.state.activeRoom);
            elem.style.backgroundColor = '#6f42c1';
            elem.style.color = 'white';
        }
        if (id) {
            const elem = document.getElementById(id.toString());
            if (elem) {
                elem.style.backgroundColor = '#2cf4eb';
                elem.style.color = 'black';
                this.setState({activeRoom: id.toString()});
            }
        }
    }

    fetchXml(name) {
        if (this.state.name !== name) {
            fetch(name, {method: 'GET'})
                .then(r => r.blob())
                .then(b => b.text())
                .then(data => this.parseMap({name: name, data: data}));
        }
    }

    parseMap(resp) {
        if (this.state.name === resp.name) {
            return;
        }
        const hint = hints[resp.name];
        const xmlOptions = {
            ignoreAttributes: false,
            attributeNamePrefix : "@_"
        };
        const isUpOrDown = (name) => name === 'up' || name === 'down';
        const xml = new XMLParser(xmlOptions).parse(resp.data);
        const rooms = xml.area.rooms.node.map(room => {
            const id = parseInt(room['@_name']);
            if (hint.ignore && hint.ignore.includes(id)) {
                return null;
            }
            const r = new Room(id, room.name, room.sector);
            if (room.exits && room.exits.node) {
                const exits = this.parseExits(room.exits.node);
                const upOrDownExits = exits.filter(exit => isUpOrDown(exit.name));
                r.setExits(exits.filter(exit => !isUpOrDown(exit.name)));
                if (upOrDownExits) {
                    r.setExtraExits(upOrDownExits);
                }
            }
            if (room.extraExits && room.extraExits.node) {
                r.setExtraExits(this.parseExits(room.extraExits.node));
            }
            return r;
        }).filter(room => room !== null);
        this.setState({name: resp.name, rooms: new Rooms(rooms, hint)});
    }

    parseExits(ex) {
        const exits = Array.isArray(ex) ? ex : [ex];
        return exits.map(exit => {
            return {name: exit['@_name'], target: exit.target, key: exit.key};
        });
    }

    componentDidUpdate() {
        // Fix room offsets based on actuall calculated values
        this.state.rooms.rooms.forEach(r => {
            const node = document.getElementById(r.id.toString());
            if (node) {
                const dx = 100 - node.offsetWidth;
                const dy = 50 - node.offsetHeight;
                node.style.top = (r.y + (dy/2)) + 'px';
                node.style.left = (r.x + (dx/2)) + 'px';
            }
        })
    }

    render() {
        if (!this.state.name) {
            return;
        }
        const sections = this.state.rooms.render();
        return (
            <div style={{display: 'flex', justifyContent: 'space-evenly', width: '100%'}}>
                <Xwrapper>
                    {sections}
                </Xwrapper>
            </div>
        );
    }

}
