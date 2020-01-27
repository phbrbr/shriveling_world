'use strict';
import { MeshPhongMaterial, LineBasicMaterial, log } from 'three';
import { Merger } from './merger';
import { DragnDrop } from '../common/utils';
import { IListFile } from '../definitions/project';
import BigBoard from './bigBoard';
import { ConeMeshShader } from '../cone/coneMeshShader';
import * as dat from 'dat.gui';
import * as kit from '@brunoimbrizi/controlkit';
import { CONFIGURATION } from '../common/configuration';

let _filesData: IListFile[] = [];

export class GUI {
  private _bigBoard: BigBoard;
  private _merger: Merger;

  public constructor(bigBoard: BigBoard, container: HTMLElement, merger: Merger) {
    this._bigBoard = bigBoard;
    this._merger = merger;
    this._initInteraction(container);
  }
  /**
   * initInteraction : Initialize GUI
   */
  private _initInteraction(container: HTMLElement): void {
    const gui = new dat.GUI();
    const bigBoard = this._bigBoard;
    let conf = {
      coneStep: CONFIGURATION.coneStep * CONFIGURATION.rad2deg,
      year: parseInt(<string>CONFIGURATION.year, 10),
      projection: {
        aucun: 0,
        equirectangulaire: 1,
        Mercator: 2,
        Winkel: 3,
        Eckert: 4,
        'Van Der Grinten': 5,
        'conic equidistant': 6,
      },
      'transport type': '',
      'cones color': '#' + (<any>CONFIGURATION.BASIC_CONE_MATERIAL).color.getHex().toString(16),
      'cones transparency': CONFIGURATION.BASIC_CONE_MATERIAL.opacity,
      'line color': '#' + CONFIGURATION.BASIC_LINE_MATERIAL.color.getHex().toString(16),
      'text color': '#' + CONFIGURATION.BASIC_TEXT_MATERIAL.color.getHex().toString(16),
      'line transparency': CONFIGURATION.BASIC_LINE_MATERIAL.opacity,
      'light color': '#' + bigBoard.light.color.getHex().toString(16),
      intensity: bigBoard.light.intensity,
      'ambient color': '#' + bigBoard.ambient.color.getHex().toString(16),
      longitude: CONFIGURATION.referenceEquiRectangular.longitude,
      latitude: CONFIGURATION.referenceEquiRectangular.latitude,
      hauteur: CONFIGURATION.referenceEquiRectangular.height,
      'standard parrallel 1': CONFIGURATION.standardParallel1 * CONFIGURATION.rad2deg,
      'standard parrallel 2': CONFIGURATION.standardParallel2 * CONFIGURATION.rad2deg,
      'with limits': true,
      exportCountry: bigBoard.orthographique,
    };

    // light
    let lightFolder = gui.addFolder('Light');
    lightFolder.add(bigBoard.ambient, 'intensity', 0, 5, 0.01).name('ambient intensity');
    lightFolder.addColor(conf, 'light color').onChange((v: string) => {
      let color = parseInt(v.replace('#', ''), 16);
      bigBoard.light.color.setHex(color);
      bigBoard.helper.color = color;
      bigBoard.helper.update();
    });
    lightFolder.addColor(conf, 'ambient color').onChange((v: string) => {
      let color = parseInt(v.replace('#', ''), 16);
      bigBoard.ambient.color.setHex(color);
    });
    lightFolder
      .add(conf, 'intensity', 0, 5, 0.01)
      .name('light intensity')
      .onChange((v: number) => {
        bigBoard.light.intensity = v;
        bigBoard.helper.update();
      });

    lightFolder.add(bigBoard.light.position, 'x', -100, 100, 1).onChange(() => bigBoard.helper.update());
    lightFolder.add(bigBoard.light.position, 'y', -100, 100, 1).onChange(() => bigBoard.helper.update());
    lightFolder.add(bigBoard.light.position, 'z', -100, 100, 1).onChange(() => bigBoard.helper.update());
    lightFolder.add(bigBoard.light.shadow.mapSize, 'width', 0, 1000).step(1);
    lightFolder.add(bigBoard.light.shadow.mapSize, 'height', 0, 1000).step(1);
    lightFolder.add(bigBoard.light.shadow.camera, 'near', 0, 1000).step(0.5);
    lightFolder.add(bigBoard.light.shadow.camera, 'far', 0, 1000).step(1);

    // generalities
    let generalFolder = gui.addFolder('Generalities');
    let projectionFolder = generalFolder.addFolder('projection');
    let referenceFolder = projectionFolder.addFolder('references');
    const radius = CONFIGURATION.earthRadiusMeters;
    function changeReference(): void {
      CONFIGURATION.referenceEquiRectangular = {
        longitude: refLong.getValue() * CONFIGURATION.deg2rad,
        latitude: refLat.getValue() * CONFIGURATION.deg2rad,
        height: refHeight.getValue(),
      };
    }
    let refLong = referenceFolder.add(conf, 'longitude', -180, 180).step(0.01);
    refLong.onChange(changeReference);

    let refLat = referenceFolder.add(conf, 'latitude', -89.99, 89.99).step(0.01);
    refLat.onChange(changeReference);
    let refHeight = referenceFolder.add(conf, 'hauteur', -radius + 10, radius + 10).step(1000);
    refHeight.onChange(changeReference);
    referenceFolder
      .add(conf, 'standard parrallel 1', -90, 90, 0.1)
      .onChange((v: number) => (CONFIGURATION.standardParallel1 = v * CONFIGURATION.deg2rad));
    referenceFolder
      .add(conf, 'standard parrallel 2', -90, 90, 0.1)
      .onChange((v: number) => (CONFIGURATION.standardParallel2 = v * CONFIGURATION.deg2rad));
    projectionFolder.add(CONFIGURATION, 'projectionInit', conf.projection).name('initial projection');
    projectionFolder.add(CONFIGURATION, 'projectionEnd', conf.projection).name('final projection');
    projectionFolder
      .add(CONFIGURATION, 'percentProjection', 0, 100)
      .step(1)
      .name('transition projection');
    let annees = generalFolder.add(conf, 'year', 1930, 2030).step(1);
    annees.onChange((v: string | number) => (CONFIGURATION.year = v));

    // toggle Camera Orthographic/Perspectiv View
    let swapView = projectionFolder.add(bigBoard, 'orthographique');
    swapView.onChange(() => (bigBoard.orthographique = !bigBoard.orthographique));
    generalFolder
      .add(bigBoard, '_showCitiesName')
      .name('Show Cities name')
      .onChange(() => bigBoard.showCitiesName()); // bigboard to parameter

    // cones
    let coneFolder = gui.addFolder('Cones');

    coneFolder
      .add(conf, 'coneStep', 1, 360)
      .step(1)
      .onChange((value: number) => (CONFIGURATION.coneStep = value * CONFIGURATION.deg2rad));
    coneFolder
      .add(ConeMeshShader, 'discriminant', 1, 20)
      .step(1);
    coneFolder.add(bigBoard, 'withLimits').onChange((value: boolean) => (conf['with limits'] = value));
    coneFolder
      .add(bigBoard.coneBoard, 'opacity', 0, 1)
      .step(0.01);
    // let terresterialFolder = coneFolder.addFolder('configurations spécifiques');
    // let terrestrialControllersList: dat.GUI[] = [];
    // let flagTransportDone = false;

    // lines
    let aerialFolder = gui.addFolder('Lines');
    aerialFolder
      .add(CONFIGURATION, 'pointsPerLine', 0, 200)
      .step(1)
      .name('number of points');
    let aerialControllersList: dat.GUI[] = [];
    let terresterialFolder = aerialFolder.addFolder('terrestrial modes');
    let terrestrialControllersList: dat.GUI[] = [];
    let flagTransportDone = false;

    // pays /mise en exergue avec listen?
    // countries / highlight with listen?
    let countryFolder = gui.addFolder('Countries');
    countryFolder.add(bigBoard.countryBoard, 'show');
    countryFolder
      .add(bigBoard.countryBoard, 'opacity', 0, 1)
      .step(0.01)
      .name('opacity');
    countryFolder.add(bigBoard.countryBoard, 'extruded', -100, 100).step(1);
    countryFolder
      .add(conf, 'exportCountry')
      .name('Export with continent')
      .onChange(() => (bigBoard.orthographique = !bigBoard.orthographique));
    let countryControllersList: dat.GUI[] = [];
    DragnDrop(
      container,
      list => {
        // container en paramètre
        if (_filesData.length === 0) {
          bigBoard.countryBoard.ready = false;
        }
        _filesData.push(...list);
        let json: string;
        _filesData.forEach(item => {
          let name = item.name.toLowerCase();
          if (name.endsWith('.geojson')) {
            json = item.text;
          } else if (name.endsWith('.csv')) {
            this._merger.add(item.text);
            if (bigBoard.state === 'ready') {
              // this is when all processes are launched
              this._merger.merge();
            }
          }
        });
        Promise.all([
          new Promise(resolve => {
            if (bigBoard.countryBoard.ready === false && json !== undefined) {
              bigBoard.countryBoard.add(JSON.parse(json)).then(() => {
                while (countryControllersList.length > 0) {
                  let subGui = countryControllersList.pop();
                  countryFolder.removeFolder(subGui);
                }
                let synonymes: string[] = [];
                bigBoard.countryBoard.countryMeshCollection
                  .sort((a, b) => a.mainName.localeCompare(b.mainName))
                  .forEach(country => {
                    let countryName = country.mainName;
                    let i = -1;
                    while (synonymes.indexOf(countryName) > -1) {
                      i++;
                      countryName = country.mainName + i;
                    }
                    synonymes.push(countryName);
                    let folder = countryFolder.addFolder(countryName);
                    folder
                      .add(country, 'extruded', -100, 100)
                      .step(1)
                      .listen();
                    folder.add(country, 'visible').listen();
                    folder
                      .add(country.material, 'opacity', 0, 1)
                      .step(0.01)
                      .listen();
                    countryControllersList.push(folder);
                  });
                resolve();
              });
            } else {
              resolve();
            }
          }),
          new Promise(resolve => {
            if (bigBoard.state === 'complete' && flagTransportDone === false) {
              flagTransportDone = true;
              while (terrestrialControllersList.length > 0) {
                let subGui = terrestrialControllersList.pop();
                terresterialFolder.removeFolder(subGui);
              }

              while (aerialControllersList.length > 0) {
                let subGui = aerialControllersList.pop();
                aerialFolder.removeFolder(subGui);
              }
              // adding aerial network(s)
              this._merger.transportNames.lines.forEach(transportName => {
                let folder = aerialFolder.addFolder(transportName);
                aerialControllersList.push(folder);
                function lineListener(): void {
                  let opacity = <number>lineOpacity.getValue();
                  let color = parseInt(lineColor.getValue().replace('#', ''), 16);
                  console.log(color);
                  bigBoard.coneBoard.lineCollection
                    .filter(line => transportName === line.transportName)
                    .forEach(line => {
                      let material = <LineBasicMaterial>line.material;
                      material.color.setHex(color);
                      material.opacity = opacity;
                    });
                }
                let lineColor = folder.addColor(conf, 'line color').name('color');
                lineColor.onChange(lineListener);
                let lineOpacity = folder
                  .add(conf, 'line transparency', 0, 1, 0.01)
                  .name('transparency');
                lineOpacity.onChange(lineListener);
              });
              // adding terrestrial networks
              console.log('adding terrestrial networks', this._merger.transportNames.cones);
              this._merger.transportNames.cones.forEach(transportName => {
                let folder = terresterialFolder.addFolder(transportName);
                terrestrialControllersList.push(folder);
                console.log('bigBoard.coneBoard', bigBoard.coneBoard);

                function lineListener(): void {
                  let opacity = <number>lineOpacity.getValue();
                  let color = parseInt(lineColor.getValue().replace('#', ''), 16);

                  bigBoard.coneBoard.lineCollection
                    .filter(line => transportName === line.transportName)
                    .forEach(line => {
                      let material = <LineBasicMaterial>line.material;
                      material.color.setHex(color);
                      material.opacity = opacity;
                    });
                }
                let lineColor = folder.addColor(conf, 'line color').name('color');
                lineColor.onChange(lineListener);
                let lineOpacity = folder
                  .add(conf, 'line transparency', 0, 1, 0.01)
                  .name('transparency');
                lineOpacity.onChange(lineListener);
              });
            }
            resolve();
          }),
        ]).then(() => {
          if (bigBoard.countryBoard.ready === true && bigBoard.state === 'complete') {
            flagTransportDone = false;
            annees
              .min(this._merger.minYear)
              .max(this._merger.maxYear)
              .updateDisplay();
            bigBoard.coneBoard.add(this._merger.conesAndEdgesData);
            // this._merger.clear();
            let sizeText = generalFolder
              .add(bigBoard, '_sizetext', 0, 2)
              .name('taille du texte')
              .step(0.1);
            sizeText.onChange(() => bigBoard.rescaleText());
            generalFolder.addColor(conf, 'text color').onChange((v: string) => {
              let color = parseInt(v.replace('#', ''), 16);
              CONFIGURATION.BASIC_TEXT_MATERIAL.color.setHex(color);
              bigBoard.updateCityName();
            });
            _filesData = [];
          }
        });
      },
      bigBoard);
  }
}
