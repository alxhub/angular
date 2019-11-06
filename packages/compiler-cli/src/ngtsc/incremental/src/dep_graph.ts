interface DepNode<T, F extends number> {
  readonly target: T;
  readonly flavor: F;
  readonly affects: ReadonlySet<DepNode<T, F>>;
}

interface DepNodeInternal<T, F extends number> extends DepNode<T, F> {
  readonly affects: Set<DepNode<T, F>>;
}

export class DepGraph<T, F extends number> {
  private map = new Map<T, (DepNode<T, F>| null)[]>();

  node(target: T, flavor: F): DepNode<T, F>|null {
    if (!this.map.has(target)) {
      return null;
    }
    const flavors = this.map.get(target) !;
    if (flavors.length <= flavor) {
      return null;
    }
    return flavors[flavor];
  }

  addDependency(upstream: T, upstreamFlavor: F, downstream: T, downstreamFlavor: F): void {}
}
