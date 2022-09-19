import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import Xarrow, { useXarrow, Xwrapper } from "react-xarrows";
import { XMLParser } from 'fast-xml-parser';
import hints from './Map.hints';

const boxStyle = {border: '#888 solid 2px', padding: '5px', maxWidth: '100px', backgroundColor: '#6f42c1', color: 'white', zIndex: 2};

const DraggableBox = ({id, text}) => {
    const nodeRef = useRef(null);
    const updateXarrow = useXarrow();
    return (
        <Draggable nodeRef={nodeRef} onDrag={updateXarrow} onStop={updateXarrow}>
            <div id={id} ref={nodeRef} style={boxStyle}>
                {text}
            </div>
        </Draggable>
    );
};

class Grid {
    constructor(){
        this.map = [];
        this.placed = new Set();
    }


    insertRoomByDirection(from, to, pos, dir) {
        let epos = [pos[0], pos[1]];
        if (dir.includes('ladder')) {
            if (this.map[pos[0]][pos[1]]) {
                dir = 'down';
            } else {
                dir = 'up';
            }
        }
        if (dir === 'north' || dir === 'up') {
            epos = [pos[0] - 1, pos[1]];
        } else if (dir === 'south' || dir === 'down') {
            epos = [pos[0] + 1, pos[1]];
        } else if (dir === 'east') {
            epos = [pos[0], pos[1] + 1];
        } else {
            epos = [pos[0], pos[1] - 1];
        }
        this.insertRoom(to, epos, dir);
    }

    print() {
        const mlen = Math.max(...this.map.flatMap(l => l.map(i => i === null ? 0 : i.toString().length)));
        const grid = this.map.map(l =>
            l.map(i => i === null ? "".padStart(mlen, " ") : i.toString().padStart(mlen - i.toString().length, " ")).join(" ")
        ).join("\n");
        console.log(grid);
    }

    hasRoom(id) {
        return this.placed.has(id);
    }

    findPos(id) {
        let pos = undefined;
        this.map.forEach((l,y) => l.forEach((c,x) => {
            if (c === id) {
                pos = [y, x];
            }
        }));
        return pos;
    }

    width() {
        return (this.map[0] && this.map[0].length) || 0;
    }

    height() {
        return this.map.length;
    }

    insertRoom(id, pos, dir) {
        if (this.hasRoom(id)) {
            return;
        }
        // console.log('Placing Room ' + id + ' to ' + dir + ' on ' + pos);
        // console.log(structuredClone(this.map));
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
            this.map.forEach((l,y) => {
                if (y !== pos[0]) {
                    l.splice(pos[1], 0, null);
                }
            });
        }
        this.placed.add(id);
        // console.log('Placed Room ' + id + ' to ' + dir + ' on ' + pos);
        // this.print();
    }
}

class Section {
    constructor(id, rooms) {
        this.id = id;
        this.rooms = rooms;
        this.adjSections = new Set();
    }

    initAdjSections(allSections) {
        this.rooms.forEach(r => {
            const exitIds = r.allExitIds();
            allSections.filter(sec => sec.containsAnyRoom(exitIds))
                .forEach(sec => this.adjSections.add(sec.id));
        });
    }

    containsAnyRoom(ids) {
        return this.rooms.find(r => ids.includes(r.id))
    }

    sectionMap() {
        const allRoomIds = new Set(this.rooms.map(r => r.id));
        const map = new Grid();
        this.rooms.forEach(r => {
            let pos = map.findPos(r.id) || [0, 0];
            if (!map.hasRoom(r.id)) {
                map.insertRoom(r.id, pos);
            }
            r.exits.concat(r.extraExits).forEach(e => {
                if (!allRoomIds.has(e.target) || map.hasRoom(e.target)) {
                    return;
                }
                map.insertRoomByDirection(r.id, e.target, pos, e.name);
                pos = map.findPos(r.id);
            });
        });
        map.print();
    }

    getArrows() {
        const arrows = new Map(this.rooms.map(r =>
            [r.id, r.exits.map(e => [r.id, e.target]).concat(r.extraExits.map(e => [r.id, e.target]))]
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
        console.log(this.rooms);
        this.sectionMap();
        const rooms = this.rooms.map(r => r.render());
        const arrows = this.getArrows();
        const allRoomIds = this.rooms.map(r => r.id);
        const rarrows = this.rooms.flatMap(r => arrows.get(r.id).filter(e => allRoomIds.includes(e[1])).map(e => (
            <Xarrow key={e[0] + "_" + e[1]}
                    start={e[0].toString()}
                    end={e[1].toString()}
                    color="#6f42c1"
                    showHead={true}
                    showTail={e.length === 3} 
                    headSize={3}
                    tailSize={3}
                    path="grid"/>
        )));
        return rooms.concat(rarrows);
    }
}

class Rooms {
    constructor(rooms, hint) {
        this.rooms = rooms;
        this.hint = hint;
        this.sections = []
        this.initSections();
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
        this.sections = this.sections.map((sec, ind) => new Section(ind, sec));
        this.sections.forEach(sec => sec.initAdjSections(this.sections));
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


}

class Room {
    constructor(id, name, sector) {
        this.id = id;
        this.name = name;
        this.sector = sector;
        this.exits = []
        this.extraExits = []
    }

    containsExit(id) {
        return (this.exits.find(e => e.target === id) || this.extraExits.find(e => e.target === id)) && true;
    }

    allExitIds() {
        return this.exits.map(r => r.target).concat(this.extraExits.map(r => r.target));
    }

    setExits(exits) {
        this.exits = exits;
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
        return (<DraggableBox key={this.id} id={this.id.toString()} text={this.name}/>);
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

    render() {
        if (!this.state.name) {
            return;
        }
        const firstSec = this.state.rooms.findSection(0);
        return (
            <div style={{display: 'flex', justifyContent: 'space-evenly', width: '100%'}}>
                <Xwrapper>
                    {firstSec.render()}
                </Xwrapper>
            </div>
        );
    }

}
