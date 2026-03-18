import {
  Component,
  ErrorHandler,
  ViewContainerRef,
  ViewChild,
  TemplateRef,
  createComponent,
  EnvironmentInjector,
} from '@angular/core';
import {TestBed, ComponentFixture} from '@angular/core/testing';

describe('Error Boundary Runtime Interception', () => {
  it('should intercept errors using createComponent onError', () => {
    let interceptedError: any;

    @Component({
      template: '{{ throwError() }}',
      standalone: true,
    })
    class ThrowingComponent {
      throwError() {
        throw new Error('Component Error');
      }
    }

    @Component({
      template: '<ng-container #vc></ng-container>',
      standalone: true,
    })
    class HostComponent {
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;
    }

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const envInjector = TestBed.inject(EnvironmentInjector);

    fixture.componentInstance.vc.createComponent(ThrowingComponent, {
      environmentInjector: envInjector,
      onError: (e: any) => {
        interceptedError = e;
      },
    });

    // The inner component is created and attached, but it hasn't run CD yet?
    // Actually `createComponent` doesn't run CD by default, we need to call `detectChanges` on the HostComponent.
    expect(() => fixture.detectChanges()).not.toThrow();

    expect(interceptedError).toBeDefined();
    expect(interceptedError).toBeInstanceOf(Error);
    expect(interceptedError!.message).toBe('Component Error');
  });

  it('should intercept errors using createEmbeddedView onError', () => {
    let interceptedError: Error | null = null;

    @Component({
      template: `
        <ng-template #tpl>{{ throwError() }}</ng-template>
        <ng-container #vc></ng-container>
      `,
      standalone: true,
    })
    class HostComponent {
      @ViewChild('tpl', {static: true}) tpl!: TemplateRef<any>;
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;

      throwError() {
        throw new Error('Template Error');
      }
    }

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.vc.createEmbeddedView(
      fixture.componentInstance.tpl,
      {},
      {
        onError: (e: Error) => {
          interceptedError = e;
        },
      },
    );

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(interceptedError).toBeDefined();
    expect(interceptedError).toBeInstanceOf(Error);
    expect(interceptedError!.message).toBe('Template Error');
  });

  it('should intercept errors thrown during component creation (e.g. ngOnInit)', () => {
    let interceptedError: Error | null = null;

    @Component({
      template: '...',
      standalone: true,
    })
    class ThrowingInitComponent {
      ngOnInit() {
        throw new Error('Init Error');
      }
    }

    @Component({
      template: '<ng-container #vc></ng-container>',
      standalone: true,
    })
    class HostComponent {
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;
    }

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const envInjector = TestBed.inject(EnvironmentInjector);

    fixture.componentInstance.vc.createComponent(ThrowingInitComponent, {
      environmentInjector: envInjector,
      onError: (e: Error) => {
        interceptedError = e;
      },
    });

    expect(() => fixture.detectChanges()).not.toThrow();

    expect(interceptedError).toBeDefined();
    expect(interceptedError).toBeInstanceOf(Error);
    expect(interceptedError!.message).toBe('Init Error');
  });

  it('should intercept errors thrown during component constructor via createComponent', () => {
    let interceptedError: Error | null = null;

    @Component({
      template: '...',
      standalone: true,
    })
    class ThrowingConstructorComponent {
      constructor() {
        throw new Error('Constructor Error');
      }
    }

    @Component({
      template: '<ng-container #vc></ng-container>',
      standalone: true,
    })
    class HostComponent {
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;
    }

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const envInjector = TestBed.inject(EnvironmentInjector);

    fixture.componentInstance.vc.createComponent(ThrowingConstructorComponent, {
      environmentInjector: envInjector,
      onError: (e: Error) => {
        interceptedError = e;
      },
    });

    expect(interceptedError).toBeDefined();
    expect(interceptedError).toBeInstanceOf(Error);
    expect(interceptedError!.message).toBe('Constructor Error');
  });

  it('should propagate errors thrown by an onError handler up the tree', () => {
    let topError: Error | null = null;

    @Component({
      template: '<ng-container #vc></ng-container>',
      standalone: true,
    })
    class MiddleComponent {
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;
    }

    @Component({
      template: '...',
      standalone: true,
    })
    class ThrowChild {
      ngOnInit() {
        throw new Error('Initial Error');
      }
    }

    @Component({
      template: '<ng-container #vc></ng-container>',
      standalone: true,
    })
    class HostComponent {
      @ViewChild('vc', {read: ViewContainerRef, static: true}) vc!: ViewContainerRef;
    }

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const middleRef = fixture.componentInstance.vc.createComponent(MiddleComponent, {
      onError: (e: Error) => {
        topError = e;
      },
    });
    fixture.detectChanges();

    middleRef.instance.vc.createComponent(ThrowChild, {
      onError: (e: Error) => {
        throw new Error('Secondary Error');
      },
    });

    expect(() => fixture.detectChanges()).not.toThrow();

    expect(topError).toBeDefined();
    expect(topError).toBeInstanceOf(Error);
    expect(topError!.message).toBe('Secondary Error');
  });
});

import {
  ɵɵboundaryCreate,
  ɵɵboundaryUpdate,
  LBoundary,
  BoundaryErrorContext,
} from '../../src/render3/instructions/control_flow';
import {ɵɵconditionalBranchCreate} from '../../src/render3/instructions/control_flow';
import {
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵelementStart,
  ɵɵelementEnd,
  ɵɵreference,
} from '../../src/render3/instructions/all';

describe('@boundary runtime instructions', () => {
  it('should render primary block and allow recovery from errors', () => {
    let mainRendered = 0;
    let errorRendered = 0;
    let throwError = false;

    // We manually simulate what the compiler generates for:
    // @boundary {
    //    {{ generateContent() }}
    // } @error (let err) {
    //    Error: {{ err.message }} <button (click)="$reset()">Reset</button>
    // }

    function MainBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0);
      }
      if (rf & 2) {
        if (throwError) {
          throw new Error('Induced Error');
        }
        mainRendered++;
        ɵɵtextInterpolate('Main Content');
      }
    }

    function ErrorBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0);
        ɵɵelementStart(1, 'button');
        {
          ɵɵtext(2, 'Reset');
        }
        ɵɵelementEnd();
      }
      if (rf & 2) {
        errorRendered++;
        ɵɵtextInterpolate('Error: ' + ctx.$error.message);
      }
    }

    @Component({
      template: '...',
      standalone: true,
    })
    class BoundaryHost {
      boundaryRef!: LBoundary;

      static ɵcmp = /*@__PURE__*/ (() => {
        const _ɵcmp = (BoundaryHost as any).ɵcmp;
        return {
          ..._ɵcmp,
          template: function BoundaryHost_Template(rf: any, ctx: any) {
            if (rf & 1) {
              ɵɵboundaryCreate(0);
              ɵɵconditionalBranchCreate(1, MainBlockTpl, 1, 1);
              ɵɵconditionalBranchCreate(2, ErrorBlockTpl, 3, 1);
            }
            if (rf & 2) {
              const boundary = ɵɵreference(0) as LBoundary;
              ctx.boundaryRef = boundary;
              let branch = -1;
              let errorCtx: BoundaryErrorContext | undefined = undefined;

              if (boundary.error !== null) {
                branch = 2; // Error block
                errorCtx = new BoundaryErrorContext(boundary);
              } else {
                branch = 1; // Main block
              }

              ɵɵboundaryUpdate(0, branch, branch === 1, errorCtx);
            }
          },
          decls: 3,
          vars: 1, // one binding slot for the conditional
        };
      })();
    }

    const fixture = TestBed.createComponent(BoundaryHost);

    // First pass: renders main block successfully
    fixture.detectChanges();
    expect(mainRendered).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Main Content');

    // Second pass: force an error
    throwError = true;
    fixture.detectChanges(); // Error is caught and state is set!

    expect(fixture.nativeElement.textContent).toContain('Error: Induced Error');
    expect(errorRendered).toBe(1);

    // After resetting, the main block should attempt to re-render
    const host = fixture.componentInstance;

    throwError = false; // "Fix" the issue
    host.boundaryRef.reset(); // Should trigger markViewForRefresh

    fixture.detectChanges();
    expect(mainRendered).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Main Content');
  });

  it('should intercept errors during the update phase', () => {
    let throwError = false;

    function MainBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0);
      }
      if (rf & 2) {
        if (throwError) {
          throw new Error('Update Phase Error');
        }
        ɵɵtextInterpolate('Main Content');
      }
    }

    function ErrorBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0);
      }
      if (rf & 2) {
        ɵɵtextInterpolate('Error: ' + ctx.$error.message);
      }
    }

    @Component({
      template: '...',
      standalone: true,
    })
    class BoundaryHost {
      static ɵcmp = /*@__PURE__*/ (() => {
        const _ɵcmp = (BoundaryHost as any).ɵcmp;
        return {
          ..._ɵcmp,
          template: function BoundaryHost_Template(rf: any, ctx: any) {
            if (rf & 1) {
              ɵɵboundaryCreate(0);
              ɵɵconditionalBranchCreate(1, MainBlockTpl, 1, 1);
              ɵɵconditionalBranchCreate(2, ErrorBlockTpl, 1, 1);
            }
            if (rf & 2) {
              const boundary = ɵɵreference(0) as LBoundary;
              let branch = boundary.error ? 2 : 1;
              let errorCtx = boundary.error ? new BoundaryErrorContext(boundary) : undefined;
              ɵɵboundaryUpdate(0, branch, branch === 1, errorCtx);
            }
          },
          decls: 3,
          vars: 1,
        };
      })();
    }

    const fixture = TestBed.createComponent(BoundaryHost);

    // First pass: complete successfully
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Main Content');

    // Second pass: introduce an error
    throwError = true;
    fixture.detectChanges();

    // Because the error was caught and markViewForRefresh called inside the error handler,
    // the host will re-run boundaryUpdate and switch branches.
    expect(fixture.nativeElement.textContent).toContain('Error: Update Phase Error');
  });

  it('should not intercept errors originating from the error block', () => {
    let topError: any;

    function MainBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0, 'Main Content');
      }
    }

    function ErrorBlockTpl(rf: any, ctx: any) {
      if (rf & 1) {
        ɵɵtext(0);
      }
      if (rf & 2) {
        throw new Error('Secondary Error');
      }
    }

    @Component({
      template: '...',
      standalone: true,
    })
    class BoundaryHost {
      boundaryRef!: LBoundary;
      static ɵcmp = /*@__PURE__*/ (() => {
        const _ɵcmp = (BoundaryHost as any).ɵcmp;
        return {
          ..._ɵcmp,
          template: function BoundaryHost_Template(rf: any, ctx: any) {
            if (rf & 1) {
              ɵɵboundaryCreate(0);
              ɵɵconditionalBranchCreate(1, MainBlockTpl, 1, 0);
              ɵɵconditionalBranchCreate(2, ErrorBlockTpl, 1, 0);
            }
            if (rf & 2) {
              const boundary = ɵɵreference(0) as LBoundary;
              ctx.boundaryRef = boundary;
              let branch = boundary.error ? 2 : 1;
              let errorCtx = boundary.error ? new BoundaryErrorContext(boundary) : undefined;
              ɵɵboundaryUpdate(0, branch, branch === 1, errorCtx);
            }
          },
          decls: 3,
          vars: 1,
        };
      })();
    }

    const CustomErrorHandler = {
      handleError(error: any) {
        topError = error;
      },
    };

    TestBed.configureTestingModule({
      providers: [{provide: ErrorHandler, useValue: CustomErrorHandler}],
    });

    const fixture = TestBed.createComponent(BoundaryHost);
    fixture.detectChanges();

    // Induce a primary error manually by mutating LBoundary since MainBlockTpl doesn't error here.
    fixture.componentInstance.boundaryRef.error = new Error('Initial Error');
    fixture.componentInstance.boundaryRef.reset(); // Wait, manually setting error state then triggering CD.
    // Actually, setting error state and triggering CD without resetting will make it branch to 2!
    fixture.componentInstance.boundaryRef.error = new Error('Trigger Error Block');

    // It will render branch 2, which will throw 'Secondary Error'.
    fixture.detectChanges();

    // And it bubbles out to the top-level error handler because we don't catch errors in the error block
    expect(topError).toBeDefined();
    expect(topError.message).toBe('Secondary Error');
  });
});
