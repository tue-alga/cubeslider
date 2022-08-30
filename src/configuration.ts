/**
 * A single cell in the grid. Contains either a cube (with the ID stored) or
 * nothing (\c null).
 */
import {ComponentStatus, Cube, Position} from "./cube";
import {Move, moveDirections} from "./move";

type WorldCell = {
    CubeId: number | null;
};

/**
 * A representation of a cubes configuration
 */
class Configuration {
    
    worldGrid: WorldCell[][][] = [];
    cubes: Cube[] = [];
    currentMove: Move | null = null;
    
    /**
     * Returns the WorldCell at the given coordinate.
     */
    private getCell([x, y, z]: Position): WorldCell {
        if (!this.worldGrid[x]) {
            this.worldGrid[x] = [];
        }
        if (!this.worldGrid[x][y]) {
            this.worldGrid[x][y] = [];
        }
        if (!this.worldGrid[x][y][z]) {
            this.worldGrid[x][y][z] = {
                CubeId: null
            };
        }
        return this.worldGrid[x][y][z];
    }

    /**
     * Returns the ID of the Cube at the given location, or null if that cell is empty.
     */
    public getCubeId(p: Position): number | null {
        return this.getCell(p).CubeId;
    }

    /**
     * Returns the Cube at the given location, or null if that cell is empty.
     */
    getCube(p: Position): Cube | null {
        const id = this.getCubeId(p);
        if (id === null) {
            return null;
        }
        return this.cubes[id];
    }

    /**
     * Checks if a Cube exists at the given location.
     */
    hasCube(p: Position): boolean {
        return !!this.getCube(p);
    }

    /**
     * Adds a cube to the world; throws if a cube already exists at that
     * location.
     */
    addCube(cube: Cube): void {
        this.addCubeUnmarked(cube);
        this.markComponents();
    }

    /**
     * As addCube(), but does not update the component status of the Cubes.
     */
    addCubeUnmarked(cube: Cube): void {
        if (this.hasCube(cube.p)) {
            throw new Error(`Tried to insert Cube on top of another Cube ` +
                `at (${cube.p})`);
        }
        this.getCell(cube.p).CubeId = this.cubes.length;
        this.cubes.push(cube);
    }

    /**
     * Moves the given cube from its current location to the given target
     * location. Throws if a cube already exists at the target.
     */
    moveCube(cube: Cube, to: Position): void {
        this.moveCubeUnmarked(cube, to);
        this.markComponents();
    }

    /**
     * As moveCube(), but does not update the component status of the Cubes.
     */
    moveCubeUnmarked(cube: Cube, to: Position): void {
        if (this.hasCube(to)) {
            throw new Error(`Tried to move Cube on top of another Cube ` +
                `at (${to})`);
        }

        const id = this.getCubeId(cube.p)!;
        this.getCell(cube.p).CubeId = null;
        this.getCell(to).CubeId = id;
        cube.p = [...to];
        cube.updatePosition(0, 0);
    }

    /**
     * Removes the cube at the given location.
     */
    removeCube(cube: Cube): void {
        this.removeCubeUnmarked(cube);
        this.markComponents();
    }

    /**
     * As removeCube(), but does not update the component status of the Cubes.
     */
    removeCubeUnmarked(cube: Cube): void {
        this.getCell(cube.p).CubeId = null;
        this.cubes = this.cubes.filter((b) => b !== cube);
        // because removing the cube from this.cubes changes the indices, we
        // need to update the CubeIds as well
        for (let i = 0; i < this.cubes.length; i++) {
            this.getCell(this.cubes[i].p).CubeId = i;
        }
    }

    /**
     * Updates the positions of all Cubes in the visualization.
     */
    updatePositions(time: number, timeStep: number): void {
        this.cubes.forEach((cube) => {
            cube.updatePosition(time, timeStep);
        });
        if (this.currentMove) {
            this.getCube(this.currentMove.position)?.updatePosition(time, timeStep, this.currentMove);
        }
    }

    /**
     * Puts all Cubes back in their starting location.
     */
    reset(): void {
        this.cubes.forEach((Cube) => {
            this.getCell(Cube.p).CubeId = null;
        });
        for (let i = 0; i < this.cubes.length; i++) {
            const cube = this.cubes[i];
            cube.p = [...cube.resetPosition];
            this.getCell(cube.p).CubeId = i;
        }
        
        
        this.currentMove = null;
        this.markComponents();
    }
    
    sortCubes() {
        this.cubes.sort((a, b) => a.p[2] - b.p[2]);
        this.cubes.sort((a, b) => a.p[1] - b.p[1]);
        this.cubes.sort((a, b) => a.p[0] - b.p[0]);
        for (let i = 0; i < this.cubes.length; i++) {
            this.getCell(this.cubes[i].p).CubeId = i;
        }
    }

    /**
     * Returns an object with keys 'x', 'X', 'y', etc. with booleans
     * indicating if the given cell has neighboring Cubes in that direction.
     */
    hasNeighbors([x, y, z]: Position): { [key: string]: boolean } {
        let has: { [key: string]: boolean } = {};
        has['x'] = this.hasCube([x - 1, y, z]);
        has['X'] = this.hasCube([x + 1, y, z]);
        has['y'] = this.hasCube([x, y - 1, z]);
        has['Y'] = this.hasCube([x, y + 1, z]);
        has['z'] = this.hasCube([x, y, z - 1]);
        has['Z'] = this.hasCube([x, y, z + 1]);
        has['xy'] = this.hasCube([x - 1, y - 1, z]);
        has['xY'] = this.hasCube([x - 1, y + 1, z]);
        has['xz'] = this.hasCube([x - 1, y, z - 1]);
        has['xZ'] = this.hasCube([x - 1, y, z + 1]);
        has['Xy'] = this.hasCube([x + 1, y - 1, z]);
        has['XY'] = this.hasCube([x + 1, y + 1, z]);
        has['Xz'] = this.hasCube([x + 1, y, z - 1]);
        has['XZ'] = this.hasCube([x + 1, y, z + 1]);
        has['yz'] = this.hasCube([x, y - 1, z - 1]);
        has['yZ'] = this.hasCube([x, y - 1, z + 1]);
        has['Yz'] = this.hasCube([x, y + 1, z - 1]);
        has['YZ'] = this.hasCube([x, y + 1, z + 1]);
        return has;
    }

    /**
     * Returns a neighbor of the give cube
     */
    getOneNeighbor(cube: Cube, cuts: [number, number][]): Cube | null {
        const [x, y, z] = cube.p;
        let neighbor = this.getCube([x + 1, y, z]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x + 1, y, z])!)) return neighbor;
        neighbor = this.getCube([x - 1, y, z]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x - 1, y, z])!)) return neighbor;
        neighbor = this.getCube([x, y + 1, z]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x, y + 1, z])!)) return neighbor;
        neighbor = this.getCube([x, y - 1, z]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x, y - 1, z])!)) return neighbor;
        neighbor = this.getCube([x, y, z + 1]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x, y, z + 1])!)) return neighbor;
        neighbor = this.getCube([x, y, z - 1]);
        if (neighbor && !this.cutsContains(cuts, this.getCubeId(cube.p)!, this.getCubeId([x, y, z - 1])!)) return neighbor;
        return null;
    }

    /**
     * Returns a map of all neighbors of a cube
     */
    getNeighborMap(p: Position): { [direction: string]: Cube | null } {
        let [x, y, z] = p;
        let neighbors: { [direction: string]: Cube | null } = {};
        neighbors['x'] = this.getCube([x - 1, y, z]);
        neighbors['X'] = this.getCube([x + 1, y, z]);
        neighbors['y'] = this.getCube([x, y - 1, z]);
        neighbors['Y'] = this.getCube([x, y + 1, z]);
        neighbors['z'] = this.getCube([x, y, z - 1]);
        neighbors['Z'] = this.getCube([x, y, z + 1]);
        neighbors['xy'] = this.getCube([x - 1, y - 1, z]);
        neighbors['xY'] = this.getCube([x - 1, y + 1, z]);
        neighbors['xz'] = this.getCube([x - 1, y, z - 1]);
        neighbors['xZ'] = this.getCube([x - 1, y, z + 1]);
        neighbors['Xy'] = this.getCube([x + 1, y - 1, z]);
        neighbors['XY'] = this.getCube([x + 1, y + 1, z]);
        neighbors['Xz'] = this.getCube([x + 1, y, z - 1]);
        neighbors['XZ'] = this.getCube([x + 1, y, z + 1]);
        neighbors['yz'] = this.getCube([x, y - 1, z - 1]);
        neighbors['yZ'] = this.getCube([x, y - 1, z + 1]);
        neighbors['Yz'] = this.getCube([x, y + 1, z - 1]);
        neighbors['YZ'] = this.getCube([x, y + 1, z + 1]);
        return neighbors;
    }

    /**
     * Given a Cube, returns a list of all the moves starting at that Cube that
     * are valid.
     *
     * If the configuration would be disconnected without the given Cube, no
     * move is valid, so an empty array is returned.
     */
    validMovesFrom(p: Position): Move[] {
        let moves: Move[] = [];

        if (!this.isConnected([], p)) {
            return [];
        }

        for (const direction of moveDirections) {
            const m = new Move(this, p, direction);
            if (m.isValidIgnoreConnectivity()) {
                // already checked connectivity before (yay, efficiency!)
                moves.push(m);
            }
        }

        return moves;
    }

    /**
     * Returns a move from and to the given coordinates.
     */
    getMoveTo(source: Cube, target: Position): Move | null {
        const moves = this.validMovesFrom(source.p);
        for (let move of moves) {
            if (move.targetPosition()[0] === target[0] &&
                move.targetPosition()[1] === target[1] &&
                move.targetPosition()[2] === target[2]) {
                return move;
            }
        }
        return null;
    }

    /**
     * Executes the shortest move path between the given Cubes.
     *
     * Returns nothing if no path exists.
     * Throws if there is no cube on the from position.
     *
     * @param from The source coordinate, containing the Cube we want to move.
     * @param to The target coordinate, which should be an empty cell.
     */
    shortestMovePath(from: Position, to: Position): Move[] {
        // temporarily remove the origin Cube from the configuration, to avoid
        // invalid moves in the resulting move path (because we could slide
        // along the origin Cube itself)
        const cube = this.getCube(from);
        if (cube === null) {
            throw "Cannot compute move path from non-existing Cube" +
            ` (${from})`;
        }
        this.removeCubeUnmarked(cube);

        // do BFS over the move graph
        // seen has positions "1,1,1" (strings) as keys
        let seen: { [key: string]: { 'seen': boolean, 'move': Move | null } } = {};
        let queue: [Position, Move | null][] = [[from, null]];

        while (queue.length !== 0) {
            const location = queue.shift()!;
            if (seen[location[0][0] + "," + location[0][1] + "," + location[0][2]]) {
                continue;
            }
            seen[location[0][0] + "," + location[0][1] + "," + location[0][2]] = {
                'seen': true,
                'move': location[1]
            };
            if (location[0][0] === to[0] && location[0][1] === to[1] && location[0][2] === to[2]) {
                // done!
                break;
            }

            const moves = this.validMovesFrom(location[0]);
            moves.forEach(function (move) {
                queue.push([move.targetPosition(), move]);
            });
        }

        if (!seen[to[0] + "," + to[1] + "," + to[2]]) {
            this.addCube(cube);
            return [];
        }

        // reconstruct the path
        let path: Move[] = [];
        let c = to;
        while (c[0] !== from[0] || c[1] !== from[1] || c[2] !== from[2]) {
            let move = seen[c[0] + "," + c[1] + "," +c[2]].move!;
            path.unshift(move);
            c = move.sourcePosition();
        }

        // put the origin Cube back
        this.addCube(cube);

        return path;
    }

    /**
     * Returns the degree of the given cube (in 6-connectivity).
     */
    degree(Cube: Cube): number {
        const has = this.hasNeighbors(Cube.p);
        let count = 0;
        for (let direction of 'xXyYzZ') {
            if (has[direction]) {
                count++;
            }
        }
        return count;
    }

    /**
     * Checks if the configuration is connected. If the skip parameter is
     * provided, that Cube is ignored (considered as non-existing).
     * @param cuts a list of pairs of neighboring cubes that are not supposed to be considered neighbors
     */
    isConnected(cuts: [number, number][] = [], skip?: Position): boolean {
        if (!this.cubes.length) {
            return true;
        }

        // do BFS from Cube 0 to check if we can reach all Cubes
        let seen = Array(this.cubes.length).fill(false);
        let seenCount = 0;
        let queue = [0];

        if (skip) {
            // mark the skipped Cube so we won't visit it again
            const skipIndex = this.getCubeId(skip);
            if (skipIndex !== null) {
                seen[skipIndex] = true;
                seenCount++;

                // special case: if we were about to start our BFS with the
                // skipped Cube, then pick another Cube to start with
                // (note that if the configuration has exactly 1 Cube, which
                // is then skipped, the function should return true
                // but that works because the BFS starting at the skipped
                // Cube will not encounter any Cubes)
                if (skipIndex === 0 && this.cubes.length > 1) {
                    queue = [1];
                }
            }
        }

        while (queue.length !== 0) {
            const cubeId = queue.shift()!;
            if (seen[cubeId]) {
                continue;
            }

            const cube = this.cubes[cubeId];
            seen[cubeId] = true;
            seenCount++;

            const neighbors = [
                this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
            ];
            neighbors.forEach((c) => {
                if (c.CubeId && !this.cutsContains(cuts, c.CubeId, cubeId)) {
                    queue.push(c.CubeId);
                }
            });
        }

        return this.cubes.length === seenCount;
    }

    /**
     * Returns the minimum and maximum x-, y-, and z-coordinates of Cubes in
     * the configuration, as an array [minX, minY, minZ, maxX, maxY, maxZ].
     */
    bounds(): [number, number, number, number, number, number] {
        return [
            this.cubes.map((Cube) => Cube.p[0]).min(),
            this.cubes.map((Cube) => Cube.p[1]).min(),
            this.cubes.map((Cube) => Cube.p[2]).min(),
            this.cubes.map((Cube) => Cube.p[0]).max(),
            this.cubes.map((Cube) => Cube.p[1]).max(),
            this.cubes.map((Cube) => Cube.p[2]).max()
        ];
    }

    /**
     * Checks whether a position is contained within the current bounding box of the configuration
     */
    boundingBoxContains([x, y, z]: [number, number, number]): boolean {
        return  x >= this.bounds()[0] && x <= this.bounds()[3] &&
                y >= this.bounds()[1] && y <= this.bounds()[4] &&
                z >= this.bounds()[2] && z <= this.bounds()[5];
    }

    /**
     * Returns the amount of cubes necessary to span the complete bounding box twice.
     */
    boundingBoxSpan(): number {
        const bounds = this.bounds();
        const width = bounds[3] - bounds[0] + 1;
        const depth = bounds[4] - bounds[1] + 1;
        const height = bounds[5] - bounds[2] + 1;
        return 2 * (width + depth + height);
    }

    /**
     * Colors the Cubes by their connectivity, and set their connectivity
     * fields
     * @param cuts a list of pairs of neighboring cubes that are not supposed to be considered neighbors 
     */
    markComponents(cuts: [number, number][] = []): void {        
        const [components, chunkIds, stable] = this.findComponents(cuts);
        for (let i = 0; i < this.cubes.length; i++) {
            if (components[i] === 2) {
                this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.CHUNK_STABLE : ComponentStatus.CHUNK_CUT);
            } else if (components[i] === 1) {
                this.cubes[i].setComponentStatus(stable[i] ? ComponentStatus.LINK_STABLE : ComponentStatus.LINK_CUT);
            } else if (components[i] === 3) {
                this.cubes[i].setComponentStatus(ComponentStatus.CONNECTOR);
            } else {
                this.cubes[i].setComponentStatus(ComponentStatus.NONE);
            }
            this.cubes[i].setChunkId(chunkIds[i]);
        }
    }

    /**
     * Returns a list of component values for each cube
     *
     * This returns three arrays. The first array indicates for each cube the
     * component status: 1 and 2 mean that the Cube is in a link or chunk,
     * respectively, while 3 means that the cube is a connector (that is, in
     * more than one component).
     * The second array contains the ID of the chunk
     * the Cube is in. If the Cube is a connector and in more than one chunk,
     * the chunk ID of the chunk closer to the root is returned. Cubes that
     * are not in a chunk get chunk ID -1.
     * The third array returns for every cube if it is stable or not (cut)
     *
     * If the configuration is disconnected, this returns -1 for both component
     * status and chunk IDs.
     */
    findComponents(cuts: [number, number][]): [number[], number[], boolean[]] {
        let components = Array(this.cubes.length).fill(-1);
        let chunkIds = Array(this.cubes.length).fill(-1);
        const stable = this.findCubeStability(cuts);

        // don't try to find components if the configuration is disconnected
        if (!this.cubes.length || !this.isConnected(cuts)) {
            return [components, chunkIds, stable];
        }

        let edgeChunks = Array();
        edgeChunks.push(Array()); // add the first component

        let discovery = Array(this.cubes.length).fill(-1);
        let low = Array(this.cubes.length).fill(-1);
        let parent = Array(this.cubes.length).fill(-1);

        let edgeStack = Array();

        // Start the search from the first cube in the array
        this.findComponentsRecursive(0, discovery, low, edgeStack, parent, 0, edgeChunks, cuts);

        // If the edgeStack is not empty, store all remaining edges in the last component
        while (edgeStack.length > 0) {
            edgeChunks[edgeChunks.length - 1].push(edgeStack.pop());
        }

        // Convert the list of edges to a chunk per cube
        // We first remove chunks with 1 or 0 edges
        // The last chunk will always have 0 edges
        let edgeChunksOfProperSize = Array();
        for (let i = 0; i < edgeChunks.length; i++) {
            if (edgeChunks[i].length > 1) {
                edgeChunksOfProperSize.push(edgeChunks[i]);
            }
        }
        for (let i = 0; i < edgeChunksOfProperSize.length; i++) {
            let edgeChunk = edgeChunksOfProperSize[i];
            for (let edge = 0; edge < edgeChunk.length; edge++) {
                for (let j = 0; j < edgeChunk[edge].length; j++) {
                    let v = edgeChunk[edge][j];
                    if (chunkIds[v] === -1) {
                        chunkIds[v] = i;
                        components[v] = 2;
                    } else if (chunkIds[v] !== i) {
                        // it already had a different chunk id, so it belongs to multiple chunks
                        // and is therefore a connector
                        components[v] = 3;
                    }
                }
            }
        }

        // Let all cubes that are not a chunk or connector be a link.
        for (let i = 0; i < components.length; i++) {
            if (components[i] === -1) {
                components[i] = 1;
            }
        }

        // Find all loose cubes.
        // A loose cube is a cube with only 1 neighbor that is in a chunk
        for (let i = 0; i < components.length; i++) {
            if (components[i] === 1 &&
                this.neighborCubesIDs(i, cuts).length === 1) {
                const neighbor = this.getOneNeighbor(this.cubes[i], cuts)!;
                const neighborIndex = this.getCubeId(neighbor.p)!;
                if (components[neighborIndex] === 2) {
                    components[i] = 2;
                    chunkIds[i] = chunkIds[neighborIndex];
                }
            }
        }
        
        // Let all cut squares in chunks that cut off something not in this chunk be a connector instead
        for (let i = 0; i < components.length; i++) {
            if (components[i] === 2 && !stable[i]) {
                const rootIndex = i === 0 ? 1 : 0;
                const capacity = this.capacity(this.cubes[i], this.cubes[rootIndex], cuts);
                if (capacity !== 1 && capacity !== this.cubes.length - 2) {
                    // this square cuts more than a single cube, and is therefore a connector instead
                    components[i] = 3;
                }
            }
        }
        
        return [components, chunkIds, stable];
    }

    private findComponentsRecursive(u: number, discovery: number[],
                                    low: number[], edgeStack: [number, number][],
                                    parent: number[], time: number, edgeChunks: [number, number][][],
                                    cuts: [number, number][]) {
        // Initialize discovery time and low value
        time += 1;
        discovery[u] = time;
        low[u] = time;
        // the number of children of u in the DFS tree
        let children = 0;

        // Go through all neighbors of vertex u.
        // There are 6 neighbor spots to check

        let nbrs = this.neighborCubesIDs(u, cuts);
        for (let v of nbrs) {
            // v is the current neighbor of u

            // if v is not visited yet, recurse
            if (discovery[v] == -1) {
                children++;
                parent[v] = u;

                // store the edge in subtree stack
                edgeStack.push([u, v]);
                this.findComponentsRecursive(v, discovery, low, edgeStack, parent, time, edgeChunks, cuts);

                // check if the subtree rooted at v has a connection to one of the ancestors of u
                if (low[u] > low[v]) {
                    low[u] = low[v];
                }

                // If u is a cut vertex,
                // pop all edges from stack till the edge u-v
                if ((discovery[u] == 1 && children > 1) || (discovery[u] > 1 && low[v] >= discovery[u])) {
                    while (edgeStack[edgeStack.length - 1][0] != u || edgeStack[edgeStack.length - 1][1] != v) {
                        edgeChunks[edgeChunks.length - 1].push(edgeStack.pop() as [number, number]);
                    }
                    edgeChunks[edgeChunks.length - 1].push(edgeStack.pop() as [number, number]);
                    // start a new chunk
                    edgeChunks.push(Array());
                }
            } else if (v != parent[u] && discovery[v] < discovery[u]) {
                // If there is a back edge, update the low value of u
                if (low[u] > discovery[v]) {
                    low[u] = discovery[v];
                }
                edgeStack.push([u, v]);
            }
        }
    }

    
    private neighborCubesIDs(i: number, cuts: [number, number][]) : number[] {
        let nbrs = Array();
        let x = this.cubes[i].p[0];
        let y = this.cubes[i].p[1];
        let z = this.cubes[i].p[2];
        if (this.hasCube([x - 1, y, z]) && !this.cutsContains(cuts, this.getCubeId([x - 1, y, z])!, i)) {
            nbrs.push(this.getCubeId([x - 1, y, z]));
        }
        if (this.hasCube([x + 1, y, z]) && !this.cutsContains(cuts, this.getCubeId([x + 1, y, z])!, i)) {
            nbrs.push(this.getCubeId([x + 1, y, z]));
        }
        if (this.hasCube([x, y- 1, z]) && !this.cutsContains(cuts, this.getCubeId([x, y - 1, z])!, i)) {
            nbrs.push(this.getCubeId([x, y - 1, z]));
        }
        if (this.hasCube([x, y + 1, z]) && !this.cutsContains(cuts, this.getCubeId([x, y + 1, z])!, i)) {
            nbrs.push(this.getCubeId([x, y + 1, z]));
        }
        if (this.hasCube([x, y, z - 1]) && !this.cutsContains(cuts, this.getCubeId([x, y, z - 1])!, i)) {
            nbrs.push(this.getCubeId([x, y, z - 1]));
        }
        if (this.hasCube([x, y, z + 1]) && !this.cutsContains(cuts, this.getCubeId([x, y, z + 1])!, i)) {
            nbrs.push(this.getCubeId([x, y, z + 1]));
        }
        return nbrs;
    }

    /**
     * Checks if a list of cuts contains a specific pair of vertices
     */
    private cutsContains(cuts: [number, number][], i: number, j: number) {
        for (let cut of cuts) {
            if (cut[0] === i && cut[1] === j) return true;
            if (cut[1] === i && cut[0] === j) return true;
        }
        return false;
    }

    /**
     * Determines which Cubes in the configuration are stable.
     *
     * Returns a list of booleans for each Cube: true if the corresponding Cube
     * is stable; false if it is a cut Cube.
     * @param cuts a list of pairs of neighboring cubes that are not supposed to be considered neighbors 
     */
    findCubeStability(cuts: [number, number][]): boolean[] {
        if (!this.cubes.length) {
            return [];
        }
        let seen = Array(this.cubes.length).fill(false);
        let parent: (number | null)[] = Array(this.cubes.length).fill(null);
        let depth = Array(this.cubes.length).fill(-1);
        let low = Array(this.cubes.length).fill(-1);
        let stable = Array(this.cubes.length).fill(true);
        this.findCubeStabilityRecursive(0, 0, seen, parent, depth, low, stable, cuts);
        return stable;
    }

    private findCubeStabilityRecursive(i: number, d: number,
                                       seen: boolean[], parent: (number | null)[],
                                       depth: number[], low: number[],
                                       stable: boolean[],
                                       cuts: [number, number][]): void {

        seen[i] = true;
        depth[i] = d;
        low[i] = d;
        let cube = this.cubes[i];

        const neighbors = [
            this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
            this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
            this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
            this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
            this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
            this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
        ];
        const self = this;
        let cutCube = false;
        let childCount = 0;
        neighbors.forEach((c) => {
            if (c.CubeId !== null && !seen[c.CubeId] && !this.cutsContains(cuts, c.CubeId, i)) {
                parent[c.CubeId] = i;
                self.findCubeStabilityRecursive(c.CubeId, d + 1,
                    seen, parent, depth, low, stable, cuts);
                childCount++;
                if (low[c.CubeId] >= depth[i]) {
                    cutCube = true;
                }
                low[i] = Math.min(low[i], low[c.CubeId]);
            } else if (c.CubeId !== null && c.CubeId != parent[i] && !this.cutsContains(cuts, c.CubeId, i)) {
                low[i] = Math.min(low[i], depth[c.CubeId]);
            }
        });
        if (parent[i] === null) {
            stable[i] = childCount <= 1;
        } else {
            stable[i] = !cutCube;
        }
    }

    /**
     * Given a Cube, determines the number of Cubes in its descendant(s),
     * Viewed from a different Cube called "root"
     * @param cuts a list of pairs of neighboring cubes that are not supposed to be considered neighbors 
     */
    capacity(s: Cube, root: Cube, cuts: [number, number][] = []): number {
        // do a BFS from the root, counting the Cubes, but disregard s

        let seen = Array(this.cubes.length).fill(false);
        const bId = this.getCubeId(s.p)!;
        seen[bId] = true;
        let cubeCount = 1;

        const rootId = this.getCubeId(root.p)!
        let queue = [rootId];

        while (queue.length !== 0) {
            const cubeId = queue.shift()!;
            if (seen[cubeId]) {
                continue;
            }

            const cube = this.cubes[cubeId];
            seen[cubeId] = true;
            if (bId !== cubeId) {
                cubeCount++;
            }

            const nbrs = [
                this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
            ];

            nbrs.forEach((c) => {
                if (c.CubeId !== null && !this.cutsContains(cuts, c.CubeId, cubeId)) {
                    queue.push(c.CubeId);
                }
            });
        }

        return this.cubes.length - cubeCount;
    }

    /**
     * Return an array with for each Cube if it contributes to the capacity of s
     * @param cuts a list of pairs of neighboring cubes that are not supposed to be considered neighbors
     */
    capacityCubes(s: Cube, root: Cube, cuts: [number, number][] = []): boolean[] {
        // do a BFS from the root, counting the Cubes, but disregard s

        let seen = Array(this.cubes.length).fill(false);
        const bId = this.getCubeId(s.p)!;
        seen[bId] = true;

        const rootId = this.getCubeId(root.p)!
        let queue = [rootId];

        while (queue.length !== 0) {
            const cubeId = queue.shift()!;
            if (seen[cubeId]) {
                continue;
            }

            const cube = this.cubes[cubeId];
            seen[cubeId] = true;

            const nbrs = [
                this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
            ];

            nbrs.forEach((c) => {
                if (c.CubeId !== null && !this.cutsContains(cuts, c.CubeId, cubeId)) {
                    queue.push(c.CubeId);
                }
            });
        }

        return seen.map(c => !c);
    }

    /**
     * Find all positions a specific cube can reach without the rest moving
     * @param s the cube to check
     */
    reachableCells(s: Cube): Position[] {
        // do a bfs over the move graph starting from s
        // seen has positions "1,1,1" (strings) as keys
        let seen: { [key: string]: { 'seen': boolean, 'position': Position } } = {};
        let queue: Position[] = [s.p];

        while (queue.length !== 0) {
            const location = queue.shift()!;
            if (seen[location[0] + "," + location[1] + "," + location[2]]) {
                continue;
            }
            seen[location[0] + "," + location[1] + "," + location[2]] = {
                'seen': true,
                'position': location
            }

            const moves = this.validMovesFrom(location);
            moves.forEach(function (move) {
                queue.push(move.targetPosition());
            });
        }

        let reachable: Position[] = [];
        for (let key in seen) {
            let position = seen[key]['position'];
            reachable.push(position);
        }

        return reachable;
    }

    /**
     * Given a cube and a set of reachable positions, find the closest cube to the cube s that
     * has a nbr that is not in those reachable positions.
     */
    findFirstCubeInDifferentComponent(s: Cube, reachable: Position[]): Cube | null{
        // do a BFS from the cube s, counting the Cubes, but disregard s

        let seen = Array(this.cubes.length).fill(false);

        const rootId = this.getCubeId(s.p)!
        let queue = [rootId];

        while (queue.length !== 0) {
            const cubeId = queue.shift()!;
            if (seen[cubeId]) {
                continue;
            }

            const cube = this.cubes[cubeId];
            seen[cubeId] = true;

            const nbrs: Position[] = [
                [cube.p[0] - 1, cube.p[1], cube.p[2]],
                [cube.p[0] + 1, cube.p[1], cube.p[2]],
                [cube.p[0], cube.p[1] - 1, cube.p[2]],
                [cube.p[0], cube.p[1] + 1, cube.p[2]],
                [cube.p[0], cube.p[1], cube.p[2] - 1],
                [cube.p[0], cube.p[1], cube.p[2] + 1]
            ];

            for (let nbrPosition of nbrs) {
                let cell = this.getCell(nbrPosition)!;
                let contained = false;
                for (let reachablePosition of reachable) {
                    if (reachablePosition[0] === nbrPosition[0] &&
                        reachablePosition[1] === nbrPosition[1] &&
                        reachablePosition[2] === nbrPosition[2]) {
                        contained = true;
                        break;
                    }
                }
                if (!contained) {
                    // this nbr empty cell is not reachable from the cube
                    // and is therefore in a different connected component
                    return cube;
                }
                if (cell.CubeId !== null) {
                    queue.push(cell.CubeId);
                }
            }
        }

        return null;
    }

    /**
     * Return an array with for each Cube if it is in the same connected component as leaf,
     * when removedCube is removed from the configuration.
     * Both removedCube and leaf are considered to be in this component
     */
    connectedComponent(removedCube: Cube, leaf: Cube): boolean[] {
        let seen = Array(this.cubes.length).fill(false);
        const removedCubeId = this.getCubeId(removedCube.p)!;
        seen[removedCubeId] = true;
        
        const leafId = this.getCubeId(leaf.p)!;
        let queue = [leafId];

        while (queue.length !== 0) {
            const cubeId = queue.shift()!;
            if (seen[cubeId]) {
                continue;
            }

            const cube = this.cubes[cubeId];
            seen[cubeId] = true;

            const nbrs = [
                this.getCell([cube.p[0] - 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0] + 1, cube.p[1], cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] - 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1] + 1, cube.p[2]]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] - 1]),
                this.getCell([cube.p[0], cube.p[1], cube.p[2] + 1])
            ];

            nbrs.forEach((c) => {
                if (c.CubeId !== null) {
                    queue.push(c.CubeId);
                }
            });
        }

        return seen;
    }

    /**
     * Determines if the configuration is xyz-monotone.
     */
    isXYZMonotone(): boolean {
        const [minX, minY, minZ, , , ] = this.bounds();

        for (const cube of this.cubes) {
            if (cube.p[0] !== minX &&
                !this.hasCube([cube.p[0] - 1, cube.p[1], cube.p[2]])) {
                return false;
            }
            if (cube.p[1] !== minY &&
                !this.hasCube([cube.p[0], cube.p[1] - 1, cube.p[2]])) {
                return false;
            }
            if (cube.p[2] !== minZ &&
                !this.hasCube([cube.p[0], cube.p[1], cube.p[2] - 1])) {
                return false;
            }
        }
        

        return true;
    }
}

export { Configuration };