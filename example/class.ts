export class A {
  foo = 'bar'
  num
  constructor() {
    this.num ||= 2
  }
}
