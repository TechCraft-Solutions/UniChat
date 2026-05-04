import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-checkbox",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./checkbox.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckboxComponent {
  @Input() checked: boolean = false;
  @Input() disabled: boolean = false;
  @Input() label: string = "";
  @Input() labelClass: string = "";
  @Input() inputClass: string = "";
  @Input() labelTextClass: string = "";

  @Output() checkedChange = new EventEmitter<boolean>();
  @Output() change = new EventEmitter<boolean>();

  onModelChange(value: boolean): void {
    this.checked = value;
    this.checkedChange.emit(value);
    this.change.emit(value);
  }
}
