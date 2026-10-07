/** Original UnityPlayer 2022.3.62f2 Physics2D broadphase/contact bookkeeping.
 * This is not an enemy-priority approximation. Native addresses and trace tests
 * are documented in rebuild/client-mechanics.md. All geometry is world-space.
 */
const f = Math.fround;
export type SwordPhysicsAabb = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export type SwordPhysicsPoint = {
    x: number;
    y: number;
};
export type SwordPhysicsTreeNode = SwordPhysicsAabb & {
    id: number;
    parent: number;
    child1: number;
    child2: number;
    height: number;
    key: string | null;
};
const union = (a: SwordPhysicsAabb, b: SwordPhysicsAabb): SwordPhysicsAabb => ({
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
});
const perimeter = (a: SwordPhysicsAabb) => f(2 * f(f(a.maxY - a.minY) + f(a.maxX - a.minX)));
const contains = (a: SwordPhysicsAabb, b: SwordPhysicsAabb) => a.minX <= b.minX && a.minY <= b.minY && a.maxX >= b.maxX && a.maxY >= b.maxY;
export const swordPhysicsAabbOverlap = (a: SwordPhysicsAabb, b: SwordPhysicsAabb) => a.minX <= b.maxX && a.minY <= b.maxY && a.maxX >= b.minX && a.maxY >= b.minY;
const expanded = (a: SwordPhysicsAabb): SwordPhysicsAabb => ({
    minX: f(a.minX - f(.1)), minY: f(a.minY - f(.1)),
    maxX: f(a.maxX + f(.1)), maxY: f(a.maxY + f(.1)),
});
export class SwordClientDynamicTree {
    root = -1;
    freeList = 0;
    nodeCount = 0;
    insertionCount = 0;
    readonly nodes: SwordPhysicsTreeNode[] = [];
    readonly moved: number[] = [];
    constructor() { this.grow(16); }
    private grow(capacity: number): void {
        const first = this.nodes.length;
        for (let id = first; id < capacity; id++)
            this.nodes.push({
                id, minX: 0, minY: 0, maxX: 0, maxY: 0, key: null,
                parent: id + 1 < capacity ? id + 1 : -1, child1: 0, child2: 0, height: -1,
            });
        this.freeList = first;
    }
    private allocate(): number {
        if (this.freeList === -1)
            this.grow(this.nodes.length * 2);
        const id = this.freeList;
        const node = this.nodes[id];
        this.freeList = node.parent;
        node.parent = node.child1 = node.child2 = -1;
        node.height = 0;
        node.key = null;
        this.nodeCount++;
        return id;
    }
    private release(id: number): void {
        const node = this.nodes[id];
        node.parent = this.freeList;
        node.height = -1;
        this.freeList = id;
        this.nodeCount--;
    }
    createProxy(key: string, aabb: SwordPhysicsAabb): number {
        const id = this.allocate();
        Object.assign(this.nodes[id], expanded(aabb), { key });
        this.insert(id);
        this.moved.push(id);
        return id;
    }
    destroyProxy(id: number): void {
        for (let i = 0; i < this.moved.length;) {
            if (this.moved[i] === id) {
                const last = this.moved.pop()!;
                if (i < this.moved.length)
                    this.moved[i] = last;
            }
            else
                i++;
        }
        this.remove(id);
        this.release(id);
    }
    moveProxy(id: number, aabb: SwordPhysicsAabb, displacement: SwordPhysicsPoint): boolean {
        if (contains(this.nodes[id], aabb))
            return false;
        this.remove(id);
        const fat = expanded(aabb);
        const dx = f(2 * displacement.x), dy = f(2 * displacement.y);
        if (dx < 0)
            fat.minX = f(fat.minX + dx);
        else
            fat.maxX = f(fat.maxX + dx);
        if (dy < 0)
            fat.minY = f(fat.minY + dy);
        else
            fat.maxY = f(fat.maxY + dy);
        Object.assign(this.nodes[id], fat);
        this.insert(id);
        this.moved.push(id);
        return true;
    }
    touchProxy(id: number): void { this.moved.push(id); }
    /** Final sorted proxy pairs make tree-query visitation order immaterial. */
    findPairs(): [
        number,
        number
    ][] {
        const result = new Map<string, [
            number,
            number
        ]>();
        for (const query of this.moved) {
            const stack = [this.root];
            while (stack.length) {
                const id = stack.pop()!;
                if (id === -1 || id === query)
                    continue;
                const node = this.nodes[id];
                if (!swordPhysicsAabbOverlap(node, this.nodes[query]))
                    continue;
                if (node.child1 !== -1)
                    stack.push(node.child1, node.child2);
                else {
                    const a = Math.min(id, query), b = Math.max(id, query);
                    result.set(`${a}:${b}`, [a, b]);
                }
            }
        }
        this.moved.length = 0;
        return [...result.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    private insert(leaf: number): void {
        this.insertionCount++;
        if (this.root === -1) {
            this.root = leaf;
            this.nodes[leaf].parent = -1;
            return;
        }
        const leafBox = this.nodes[leaf];
        let sibling = this.root;
        while (this.nodes[sibling].child1 !== -1) {
            const node = this.nodes[sibling];
            const combined = perimeter(union(node, leafBox));
            const cost = f(2 * combined);
            const inherited = f(2 * f(combined - perimeter(node)));
            const childCost = (id: number) => {
                const child = this.nodes[id], next = perimeter(union(child, leafBox));
                return f((child.child1 === -1 ? next : f(next - perimeter(child))) + inherited);
            };
            const c1 = childCost(node.child1), c2 = childCost(node.child2);
            if (cost < c1 && cost < c2)
                break;
            sibling = c1 < c2 ? node.child1 : node.child2;
        }
        const oldParent = this.nodes[sibling].parent;
        const parent = this.allocate();
        Object.assign(this.nodes[parent], union(leafBox, this.nodes[sibling]), {
            parent: oldParent, child1: sibling, child2: leaf, height: this.nodes[sibling].height + 1,
        });
        if (oldParent === -1)
            this.root = parent;
        else if (this.nodes[oldParent].child1 === sibling)
            this.nodes[oldParent].child1 = parent;
        else
            this.nodes[oldParent].child2 = parent;
        this.nodes[sibling].parent = this.nodes[leaf].parent = parent;
        this.repair(parent);
    }
    private remove(leaf: number): void {
        if (this.root === leaf) {
            this.root = -1;
            return;
        }
        const parent = this.nodes[leaf].parent;
        const parentNode = this.nodes[parent], grand = parentNode.parent;
        const sibling = parentNode.child1 === leaf ? parentNode.child2 : parentNode.child1;
        if (grand === -1) {
            this.root = sibling;
            this.nodes[sibling].parent = -1;
            this.release(parent);
        }
        else {
            if (this.nodes[grand].child1 === parent)
                this.nodes[grand].child1 = sibling;
            else
                this.nodes[grand].child2 = sibling;
            this.nodes[sibling].parent = grand;
            this.release(parent);
            this.repair(grand);
        }
    }
    private repair(start: number): void {
        for (let id = start; id !== -1;) {
            id = this.balance(id);
            const node = this.nodes[id], a = this.nodes[node.child1], b = this.nodes[node.child2];
            Object.assign(node, union(a, b));
            node.height = 1 + Math.max(a.height, b.height);
            id = node.parent;
        }
    }
    private balance(id: number): number {
        const a = this.nodes[id];
        if (a.child1 === -1 || a.height < 2)
            return id;
        const b = this.nodes[a.child1], c = this.nodes[a.child2];
        const delta = c.height - b.height;
        if (delta >= -1 && delta <= 1)
            return id;
        const promoted = delta > 1 ? c : b;
        const first = this.nodes[promoted.child1], second = this.nodes[promoted.child2];
        promoted.child1 = id;
        promoted.parent = a.parent;
        a.parent = promoted.id;
        if (promoted.parent === -1)
            this.root = promoted.id;
        else if (this.nodes[promoted.parent].child1 === id)
            this.nodes[promoted.parent].child1 = promoted.id;
        else
            this.nodes[promoted.parent].child2 = promoted.id;
        const high = first.height > second.height ? first : second;
        const low = first.height > second.height ? second : first;
        promoted.child2 = high.id;
        low.parent = id;
        if (delta > 1)
            a.child2 = low.id;
        else
            a.child1 = low.id;
        Object.assign(a, union(delta > 1 ? b : c, low));
        a.height = 1 + Math.max((delta > 1 ? b : c).height, low.height);
        Object.assign(promoted, union(a, high));
        promoted.height = 1 + Math.max(a.height, high.height);
        return promoted.id;
    }
    snapshot() {
        return { root: this.root, freeList: this.freeList, nodeCount: this.nodeCount,
            insertionCount: this.insertionCount, moved: [...this.moved], nodes: this.nodes.map(n => ({ ...n })) };
    }
}
export type SwordPhysicsFixture = {
    key: string;
    bodyKey: string;
    bodyType: "static" | "dynamic" | "kinematic";
    /** Only relative instance-ID order within a pair affects two-sided dispatch. */
    instanceId: number;
    aabb: SwordPhysicsAabb;
    proxyId: number;
};
type NativeContact = {
    a: string;
    b: string;
    touching: boolean;
    serial: number;
};
type UnityPair = {
    a: string;
    b: string;
    state: 1 | 2 | 3 | 4;
    count: number;
    suspended: boolean;
};
export type SwordPhysicsCallback = {
    a: string;
    b: string;
    event: "enter" | "exit" | "stay";
};
/** Sensor-only path; every Sword collider is a trigger, including monster pairs. */
export class SwordClientContactHistory {
    readonly tree = new SwordClientDynamicTree();
    readonly fixtures = new Map<string, SwordPhysicsFixture>();
    private contacts: NativeContact[] = [];
    private pairs: UnityPair[] = [];
    private serial = 0;
    private hasNewFixtures = false;
    addFixture(fixture: Omit<SwordPhysicsFixture, "proxyId">): void {
        if (this.fixtures.has(fixture.key))
            throw new Error(`Duplicate fixture ${fixture.key}`);
        const proxyId = this.tree.createProxy(fixture.key, fixture.aabb);
        this.fixtures.set(fixture.key, { ...fixture, aabb: { ...fixture.aabb }, proxyId });
        this.hasNewFixtures = true;
    }
    removeFixture(key: string, rebuilding = false): void {
        const fixture = this.fixtures.get(key);
        if (!fixture)
            return;
        // b2Body contact edges are inserted at the head: destruction is reverse creation.
        if (rebuilding)
            for (const p of this.pairs)
                if (p.a === key || p.b === key)
                    p.suspended = true;
        const doomed = this.contacts.filter(c => c.a === key || c.b === key).sort((a, b) => b.serial - a.serial);
        for (const contact of doomed)
            this.removeContact(this.contacts.indexOf(contact));
        this.tree.destroyProxy(fixture.proxyId);
        this.fixtures.delete(key);
        if (!rebuilding) {
            for (const p of this.pairs)
                if (p.a === key || p.b === key) {
                    p.state = 2;
                    p.suspended = false;
                }
            // Collider deactivation invokes the same collector with this collider filter,
            // synchronously; unrelated active-pair records remain in place.
            this.collectCallbacks(key);
        }
    }
    rebuildFixture(key: string, patch: Partial<Omit<SwordPhysicsFixture, "key" | "proxyId">> = {}): void {
        const fixture = this.fixtures.get(key);
        if (!fixture)
            throw new Error(`Missing fixture ${key}`);
        this.removeFixture(key, true);
        this.addFixture({ ...fixture, ...patch });
    }
    setBodyType(bodyKey: string, bodyType: SwordPhysicsFixture["bodyType"], aabb?: SwordPhysicsAabb): void {
        const fixtures = [...this.fixtures.values()].filter(c => c.bodyKey === bodyKey);
        if (!fixtures.length || fixtures.every(c => c.bodyType === bodyType))
            return;
        for (const fixture of fixtures) {
            this.rebuildFixture(fixture.key, { bodyType, aabb: aabb ?? fixture.aabb });
            const proxy = this.fixtures.get(fixture.key)!.proxyId;
            this.tree.touchProxy(proxy);
            this.tree.touchProxy(proxy);
        }
    }
    synchronize(key: string, aabb: SwordPhysicsAabb, displacement: SwordPhysicsPoint, swept: boolean): void {
        const fixture = this.fixtures.get(key);
        if (!fixture)
            throw new Error(`Missing fixture ${key}`);
        this.tree.moveProxy(fixture.proxyId, swept ? union(fixture.aabb, aabb) : aabb, displacement);
        fixture.aabb = { ...aabb };
    }
    private findNewContacts(): void {
        for (const [aId, bId] of this.tree.findPairs()) {
            const a = this.fixtures.get(this.tree.nodes[aId].key!)!, b = this.fixtures.get(this.tree.nodes[bId].key!)!;
            if (a.bodyKey === b.bodyKey || (a.bodyType === "static" && b.bodyType === "static"))
                continue;
            if (this.contacts.some(c => (c.a === a.key && c.b === b.key) || (c.a === b.key && c.b === a.key)))
                continue;
            this.contacts.push({ a: a.key, b: b.key, touching: false, serial: this.serial++ });
        }
        this.hasNewFixtures = false;
    }
    /** Native Collide precedes integration; new fixtures discover pairs first. */
    collide(overlap: (a: string, b: string) => boolean): void {
        if (this.hasNewFixtures)
            this.findNewContacts();
        for (let i = 0; i < this.contacts.length;) {
            const contact = this.contacts[i], a = this.fixtures.get(contact.a)!, b = this.fixtures.get(contact.b)!;
            if (!swordPhysicsAabbOverlap(this.tree.nodes[a.proxyId], this.tree.nodes[b.proxyId])) {
                this.removeContact(i);
                continue;
            }
            this.updateContact(contact, overlap);
            i++;
        }
    }
    /** Original world Step's final sensor pass walks the global linked list,
     * whose head is the newest contact, NOT the normal-contact array. */
    finishIntegration(overlap?: (a: string, b: string) => boolean): void {
        this.findNewContacts();
        if (overlap)
            for (const contact of [...this.contacts].sort((a, b) => b.serial - a.serial))
                this.updateContact(contact, overlap);
    }
    private updateContact(contact: NativeContact, overlap: (a: string, b: string) => boolean): void {
        const touching = overlap(contact.a, contact.b);
        if (touching !== contact.touching) {
            if (touching)
                this.begin(contact);
            else
                this.end(contact);
            contact.touching = touching;
        }
    }
    private pairFor(contact: NativeContact): UnityPair | undefined {
        return this.pairs.find(p => (p.a === contact.a && p.b === contact.b) || (p.a === contact.b && p.b === contact.a));
    }
    private begin(contact: NativeContact): void {
        const existing = this.pairFor(contact);
        if (existing) {
            existing.count++;
            if (!existing.suspended) {
                if (existing.state === 3)
                    existing.state = 1;
                else if (existing.state === 2)
                    existing.state = 4;
            }
        }
        else {
            const a = this.fixtures.get(contact.a)!, b = this.fixtures.get(contact.b)!;
            this.pairs.push({ a: a.instanceId < b.instanceId ? a.key : b.key,
                b: a.instanceId < b.instanceId ? b.key : a.key, state: 1, count: 1, suspended: false });
        }
    }
    private end(contact: NativeContact): void {
        const pair = this.pairFor(contact);
        if (!pair)
            throw new Error("Native touching contact is missing its Unity pair.");
        if (--pair.count <= 0 && !pair.suspended) {
            if (pair.state === 1)
                pair.state = 3;
            else if (pair.state === 4)
                pair.state = 2;
        }
    }
    private removeContact(index: number): void {
        const contact = this.contacts[index];
        if (contact.touching)
            this.end(contact);
        const last = this.contacts.pop()!;
        if (index < this.contacts.length)
            this.contacts[index] = last;
    }
    collectCallbacks(filter?: string, awake: (key: string) => boolean = () => true): SwordPhysicsCallback[] {
        const callbacks: SwordPhysicsCallback[] = [];
        for (let i = 0; i < this.pairs.length;) {
            const pair = this.pairs[i];
            if (filter && pair.a !== filter && pair.b !== filter) {
                i++;
                continue;
            }
            if (pair.suspended) {
                pair.suspended = false;
                if (pair.count === 0)
                    pair.state = 2;
            }
            if (pair.state === 1 || pair.state === 3)
                callbacks.push({ a: pair.a, b: pair.b, event: "enter" });
            if (pair.state === 2 || pair.state === 3) {
                callbacks.push({ a: pair.a, b: pair.b, event: "exit" });
                const last = this.pairs.pop()!;
                if (i < this.pairs.length)
                    this.pairs[i] = last;
            }
            else {
                if (pair.state === 4 && (awake(pair.a) || awake(pair.b)))
                    callbacks.push({ a: pair.a, b: pair.b, event: "stay" });
                pair.state = 4;
                i++;
            }
        }
        return callbacks;
    }
    snapshot() {
        return { tree: this.tree.snapshot(), fixtures: [...this.fixtures.values()].map(c => ({ ...c, aabb: { ...c.aabb } })),
            contacts: this.contacts.map(c => ({ ...c })), pairs: this.pairs.map(p => ({ ...p })) };
    }
}
