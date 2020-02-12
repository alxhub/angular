/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import '@angular/core/test/bundling/util/src/reflect_metadata';

import {CommonModule} from '@angular/common';
import {Component, Injectable, NgModule, ViewEncapsulation, ngTemplate, ɵmarkDirty as markDirty, ɵrenderComponent as renderComponent} from '@angular/core';

class Todo {
  editing: boolean;

  // TODO(issue/24571): remove '!'.
  private _title !: string;
  get title() { return this._title; }
  set title(value: string) { this._title = value.trim(); }

  constructor(title: string, public completed: boolean = false) {
    this.editing = false;
    this.title = title;
  }
}

@Injectable({providedIn: 'root'})
class TodoStore {
  todos: Array<Todo> = [
    new Todo('Demonstrate Components'),
    new Todo('Demonstrate Structural Directives', true),
    new Todo('Demonstrate NgModules'),
    new Todo('Demonstrate zoneless change detection'),
    new Todo('Demonstrate internationalization'),
  ];

  private getWithCompleted(completed: boolean) {
    return this.todos.filter((todo: Todo) => todo.completed === completed);
  }

  allCompleted() { return this.todos.length === this.getCompleted().length; }

  setAllTo(completed: boolean) { this.todos.forEach((t: Todo) => t.completed = completed); }

  removeCompleted() { this.todos = this.getWithCompleted(false); }

  getRemaining() { return this.getWithCompleted(false); }

  getCompleted() { return this.getWithCompleted(true); }

  toggleCompletion(todo: Todo) { todo.completed = !todo.completed; }

  remove(todo: Todo) { this.todos.splice(this.todos.indexOf(todo), 1); }

  add(title: string) { this.todos.push(new Todo(title)); }
}

@Component({
  selector: 'todo-app',
  // TODO(misko): make this work with `[(ngModel)]`
  encapsulation: ViewEncapsulation.None,
  // TODO(misko): switch over to OnPush
  // changeDetection: ChangeDetectionStrategy.OnPush
})
class ToDoAppComponent {
  newTodoText = '';

  constructor(public todoStore: TodoStore) {}

  render(): unknown {
    return ngTemplate `
    <section class="todoapp">
      <header class="header">
        <h1>todos</h1>
        <input class="new-todo" placeholder="What needs to be done?" autofocus=""
               [value]="${this.newTodoText}"
               (keyup)="$event.code == 'Enter' ? ${this}.addTodo() : ${this}.updateNewTodoValue($event.target.value)">
      </header>
      <section *ngIf="${this.todoStore.todos.length} > 0" class="main">
        <input *ngIf="${this.todoStore.todos.length}"
               #toggleall class="toggle-all" type="checkbox"
               [checked]="${this.todoStore}.allCompleted()"
               (click)="${this}.toggleAllTodos(toggleall.checked)">
        <ul class="todo-list">
          <li *ngFor="let todo of ${this.todoStore.todos}"
              [class.completed]="todo.completed"
              [class.editing]="todo.editing">
            <div class="view">
              <input class="toggle" type="checkbox"
                     (click)="${this}.toggleCompletion(todo)"
                     [checked]="todo.completed">
              <label (dblclick)="${this}.editTodo(todo)">{{todo.title}}</label>
              <button class="destroy" (click)="${this}.remove(todo)"></button>
            </div>
            <input *ngIf="todo.editing"
                   class="edit" #editedtodo
                   [value]="todo.title"
                   (blur)="${this}.updateEditedTodoValue(todo, editedtodo.value)"
                   (keyup)="${this}.updateEditedTodoValue(todo, $event.target.value)"
                   (keyup)="$event.code == 'Enter' && ${this}.updateEditedTodoValue(todo, editedtodo.value)"
                   (keyup)="$event.code == 'Escape' && ${this}.cancelEditingTodo(todo)">
          </li>
        </ul>
      </section>
      <footer *ngIf="${this.todoStore.todos.length > 0}" class="footer">
        <span class="todo-count">
          <strong>{{ ${this.todoStore.getRemaining().length} }}</strong>
          {{ ${this.todoStore.getRemaining().length == 1 ? 'item' : 'items'} }} left
        </span>
        <button *ngIf="${this.todoStore.getCompleted().length > 0}"
                class="clear-completed"
                (click)="${this}.removeCompleted()">
          Clear completed
        </button>
      </footer>
    </section>
    `;
  }

  cancelEditingTodo(todo: Todo) {
    todo.editing = false;
    markDirty(this);
  }

  finishUpdatingTodo(todo: Todo, editedTitle: string) {
    editedTitle = editedTitle.trim();

    if (editedTitle.length === 0) {
      this.remove(todo);
    }

    todo.title = editedTitle;
    this.cancelEditingTodo(todo);
  }

  editTodo(todo: Todo) {
    todo.editing = true;
    markDirty(this);
  }

  removeCompleted() {
    this.todoStore.removeCompleted();
    markDirty(this);
  }

  toggleCompletion(todo: Todo) {
    this.todoStore.toggleCompletion(todo);
    markDirty(this);
  }

  remove(todo: Todo) {
    this.todoStore.remove(todo);
    markDirty(this);
  }

  addTodo() {
    if (this.newTodoText.trim().length) {
      this.todoStore.add(this.newTodoText);
      this.newTodoText = '';
    }
    markDirty(this);
  }

  toggleAllTodos(checked: boolean) {
    this.todoStore.setAllTo(checked);
    markDirty(this);
  }

  updateEditedTodoValue(todo: Todo, value: string) {
    todo.title = value;
    markDirty(this);
  }

  updateNewTodoValue(value: string) {
    this.newTodoText = value;
    markDirty(this);
  }
}

@NgModule({declarations: [ToDoAppComponent], imports: [CommonModule]})
class ToDoAppModule {
}

renderComponent(ToDoAppComponent);
