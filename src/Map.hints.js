const hints = {
    "map/galeon.are.xml": {
        ignore: [ 40004 ],
        fixDirection: [
            { from: 40007, to: 40008, dir: 'down'},
            { from: 40003, to: 40031, dir: 'up' },
            { from: 40006, to: 40029, dir: 'up' },
            { from: 40006, to: 40024, dir: 'down' },
            { from: 40009, to: 40034, dir: 'up' },
            { from: 40001, to: 40101, dir: 'up' },
        ],
        moveSectionRooms: {
            0: [
                {room: 40005, to: "l"},
                {room: 40026, to: "ll"} 
            ]
        },
        centralSection: 0,
        movePlacedSectionRooms: {
            2: [
                {room: 40010, to: "r"},
                {room: 40009, to: "r"}
            ]
        },
        placeSectionAt: {
            9: {room: 40102, to: [1, 0]}
        },
        moveMapRooms: [
            {room: 40022, to: "uul"},
            {room: 40015, to: "r"}
        ]
    },
    "map/mirror.are.xml": {
        moveSectionRoomsAfterPlacement: {
            0: [
                {room: 5394, to: "l"}
            ]
        }
    }
};

export default hints;
