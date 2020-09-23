import * as PIXI from 'pixi.js';

import {Direction, Ball, Color} from './ball';
import {World} from './world';
import {Button, Separator, Toolbar} from './ui';

enum EditMode {
	SELECT, ADD_BALL
}

enum SimulationMode {
	RUNNING, PAUSED, RESET
}

class CubesSimulator {
	private app: PIXI.Application;

	editMode: EditMode = EditMode.SELECT;
	time: number = 0.0;
	timeStep: number = 0;
	runUntil: number = Infinity;

	simulationMode: SimulationMode = SimulationMode.RESET;
	timeSpeed: number = 0.05;

	world: World;

	// selected objects
	private selection: Ball[] = [];

	// direction and color of last-edited ball
	// (remembered to insert new balls with the same direction and color)
	private lastDirection = Direction.RIGHT;
	private lastColor = Color.GRAY;

	// GUI elements
	private bottomBar: Toolbar;

	private runButton: Button;
	private stepButton: Button;
	private resetButton: Button;
	
	private selectButton: Button;
	private addBallButton: Button;
	private colorButton: Button;
	private deleteButton: Button;

	private saveButton: Button;

	private textArea = document.getElementById('save-textarea') as HTMLTextAreaElement;

	constructor(app: PIXI.Application) {
		this.app = app;

		this.world = new World();

		this.bottomBar = new Toolbar();

		this.runButton = new Button("play", "Run simulation", "Space");
		this.runButton.onClick(this.run.bind(this));
		//this.bottomBar.addChild(this.runButton);

		this.stepButton = new Button("step", "Run one step");
		this.stepButton.onClick(this.step.bind(this));
		//this.bottomBar.addChild(this.stepButton);

		this.resetButton = new Button("reset", "Reset simulation", "R");
		this.resetButton.onClick(this.reset.bind(this));
		this.resetButton.setEnabled(false);
		//this.bottomBar.addChild(this.resetButton);

		//this.bottomBar.addChild(new Separator());

		this.selectButton = new Button(
			"select", "Select objects", "S");
		this.selectButton.setPressed(true);
		this.selectButton.onClick(this.selectMode.bind(this));
		this.bottomBar.addChild(this.selectButton);

		this.addBallButton = new Button(
			"add-ball", "Add/remove cubes", "C");
		this.addBallButton.onClick(this.addBallsMode.bind(this));
		this.bottomBar.addChild(this.addBallButton);

		this.colorButton = new Button(
			"color", "Change color");
		this.colorButton.onClick(
			() => {
				this.selection.forEach((ball) => {
					if (ball instanceof Ball) {
						ball.nextColor();
						if (this.selection.length === 1) {
							this.lastColor = ball.color;
						}
					}
				});
			}
		);
		this.colorButton.setEnabled(false);
		this.bottomBar.addChild(this.colorButton);

		this.deleteButton = new Button(
			"delete", "Delete selected", "Delete");
		this.deleteButton.onClick(this.delete.bind(this));
		this.deleteButton.setEnabled(false);
		this.bottomBar.addChild(this.deleteButton);

		this.bottomBar.addChild(new Separator());

		this.saveButton = new Button(
			"save", "Save & load");
		this.saveButton.onClick(this.save.bind(this));
		this.bottomBar.addChild(this.saveButton);


		// set up event handlers for dialog buttons
		const loadButton = document.getElementById('load-button');
		loadButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
			this.load(this.textArea.value);
		});

		const closeButton = document.getElementById('close-button');
		closeButton!.addEventListener('click', () => {
			document.getElementById('dialogs')!.style.display = 'none';
		});


		this.app.ticker.add((delta) => {
			this.renderFrame(delta);
		});


		this.setup();
	}

	setup() {
		this.app.stage.addChild(this.world.viewport);

		/*this.world.addBall(2, -2, Direction.RIGHT);
		this.world.addBall(4, -4, Direction.UP);
		this.world.addBall(8, -4, Direction.LEFT);
		this.world.addBall(10, -8, Direction.UP);
		this.world.addBall(7, -5, Direction.LEFT);
		//this.world.addBall(6, -2, Direction.DOWN);
		this.world.addBall(12, -12, Direction.UP);
		//this.world.addBall(12, 6, Direction.DOWN);*/
		
		/*// and gate
		this.world.addBall(-3, 1, Direction.RIGHT);
		this.world.addBall(0, 4, Direction.DOWN);
		this.world.addWall([1, 3], [2, 2]);
		this.world.addWall([-2, -2], [-1, -3]);*/

		this.bottomBar.rebuildPixi();
		this.app.stage.addChild(this.bottomBar.getPixi());

		this.world.balls.forEach((ball) => {
			ball.placeDots(0);
		});

		// click handler
		this.world.pixi.interactive = true;
		this.world.pixi.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);  // TODO should be infinite ...
		this.world.pixi.on('click', this.worldClickHandler.bind(this));
		this.world.pixi.on('tap', this.worldClickHandler.bind(this));

		// key handlers
		window.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key === " ") {
				this.run();
			} else if (event.key === "r") {
				this.reset();
			} else if (event.key === "s") {
				this.selectMode();
			} else if (event.key === "c") {
				this.addBallsMode();
			} else if (event.key === "Delete") {
				this.delete();
			}
		});

		this.update();
	}

	update(): void {
	}

	select(obj: Ball): void {
		this.selection.push(obj);
		obj.selected = true;
		obj.updatePosition(this.time, this.timeStep);
		this.updateEditButtons();
	}

	deselect(): void {
		this.selection.forEach((ball) => {
			ball.selected = false;
			ball.updatePosition(this.time, this.timeStep);
		});

		this.selection = [];
		this.updateEditButtons();
	}

	private updateEditButtons(): void {
		this.colorButton.setEnabled(this.selection.length > 0);
		this.deleteButton.setEnabled(this.selection.length > 0);
	}

	renderFrame(delta: number): void {
		if (this.simulationMode === SimulationMode.RUNNING) {
			this.time += this.timeSpeed * delta;

			if (this.time > this.runUntil) {
				this.time = this.runUntil;
				this.simulationMode = SimulationMode.PAUSED;
				this.runButton.setIcon("play");
				this.runButton.setTooltip("Run simulation");
				this.stepButton.setEnabled(true);
			}
		}

		while (Math.floor(this.time) > this.timeStep) {
			this.timeStep++;
			try {
				this.world.nextStep(this.timeStep);
			} catch (e) {
				window.alert(`Illegal move: ${e}. Resetting the simulation.`);
				this.reset();
			}
		}

		this.world.pixi.x = window.innerWidth / 2;
		this.world.pixi.y = window.innerHeight / 2;
		
		this.bottomBar.setPosition(
			window.innerWidth / 2 - this.bottomBar.getWidth() / 2,
			window.innerHeight - this.bottomBar.getHeight());

		this.world.balls.forEach((ball) => {
			ball.updatePosition(this.time, this.timeStep);
		});
	}
	
	worldClickHandler(e: PIXI.interaction.InteractionEvent): void {
		const p = e.data.getLocalPosition(this.world.pixi);
		let x = p.x / 80;
		let y = -p.y / 80;
		console.log(x, y);

		if (this.simulationMode === SimulationMode.RESET) {

			if (this.editMode === EditMode.SELECT) {
				this.deselect();
				const ball = this.world.getBall(Math.round(x), Math.round(y));
				if (ball) {
					this.deselect();
					this.select(ball);
				}
			}

			if (this.editMode === EditMode.ADD_BALL) {
				x = Math.round(x);
				y = Math.round(y);

				const ball = this.world.getBall(x, y);
				if (!ball) {
					const newBall = this.world.addBall(x, y, this.lastDirection, this.lastColor);
					this.deselect();
					this.select(newBall);
				} else {
					this.world.removeBall(ball.p.x, ball.p.y);
				}
			}
		}
	}

	// button handlers

	run(): void {
		if (this.simulationMode === SimulationMode.RUNNING) {
			this.simulationMode = SimulationMode.PAUSED;
			this.runButton.setIcon("play");
			this.runButton.setTooltip("Run simulation");
			this.stepButton.setEnabled(true);
		} else {
			this.runUntil = Infinity;
			this.simulationMode = SimulationMode.RUNNING;
			this.runButton.setIcon("pause");
			this.runButton.setTooltip("Pause simulation");
			this.stepButton.setEnabled(false);
		}

		this.deselect();
		this.resetButton.setEnabled(true);
		this.selectButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.saveButton.setEnabled(false);
	}

	step(): void {
		this.runUntil = Math.floor(this.time) + 1;
		this.simulationMode = SimulationMode.RUNNING;
		this.runButton.setIcon("pause");
		this.runButton.setTooltip("Pause simulation");

		this.deselect();
		this.stepButton.setEnabled(false);
		this.resetButton.setEnabled(true);
		this.selectButton.setEnabled(false);
		this.addBallButton.setEnabled(false);
		this.saveButton.setEnabled(false);
	}

	reset(): void {
		this.simulationMode = SimulationMode.RESET;
		this.runButton.setIcon("play");
		this.runButton.setTooltip("Run simulation");
		this.stepButton.setEnabled(true);
		this.resetButton.setEnabled(false);

		this.selectButton.setEnabled(true);
		this.addBallButton.setEnabled(true);
		this.saveButton.setEnabled(true);

		this.world.reset();
		this.time = 0;
		this.timeStep = 0;
		this.runUntil = Infinity;
	}

	selectMode(): void {
		this.editMode = EditMode.SELECT;
		this.selectButton.setPressed(true);
		this.addBallButton.setPressed(false);
	}

	addBallsMode(): void {
		this.editMode = EditMode.ADD_BALL;
		this.selectButton.setPressed(false);
		this.addBallButton.setPressed(true);
	}
	
	delete(): void {
		this.selection.forEach((obj) => {
			if (obj instanceof Ball) {
				const [x, y] = [obj.p.x, obj.p.y];
				this.world.removeBall(x, y);
			}
			this.deselect();
		});
	}

	save(): void {
		const file = this.world.serialize();
		const dialogs = document.getElementById('dialogs');
		dialogs!.style.display = 'block';
		this.textArea.value = file;
	}

	load(data: string): void {
		const newWorld = new World();
		try {
			newWorld.deserialize(data);
		} catch (e) {
			window.alert('Could not read JSON data: ' + e);
			return;
		}
		this.world = newWorld;
		this.app.stage.removeChildren();
		this.setup();
	}
}

class Constants {
	static readonly tooltipStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 16,
		fill: "white"
	});
	static readonly tooltipSmallStyle = new PIXI.TextStyle({
		fontFamily: "Fira Sans",
		fontSize: 12,
		fill: "white"
	});
}

export {CubesSimulator, Constants};

