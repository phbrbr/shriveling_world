namespace shriveling {
    'use strict';

    const forbiddenAttributes = ['referential', 'position'];

    export class ConeBoard {
        public coneMeshCollection: PseudoCone[] = [];
        private _projection: string;
        private _scene: THREE.Scene;
        private _camera: THREE.Camera;
        private _raycaster: THREE.Raycaster;
        private _highlitedCriterias: ICriterias = {};
        private _selectedMeshs: THREE.Mesh[] = [];
        private _scale: number = 1;
        private _show: boolean = true;
        private _withLimits: boolean = true;
        private _countries: CountryBoard;
        private _year: string;
        private _sumUpProperties: ISumUpCriteria = {};
        private _renderer: THREE.WebGLRenderer;

        get show(): boolean {
            return this._show;
        }
        set show(value: boolean) {
            this.coneMeshCollection.forEach((country) => {
                country.visible = value;
            });
            this._show = value;
        }

        get withLimits(): boolean {
            return this._withLimits;
        }
        set withLimits(value: boolean) {
            this.coneMeshCollection.forEach((country) => {
                country.withLimits = value;
            });
            this._withLimits = value;
        }

        get scale(): number {
            return this._scale;
        }
        set scale(value: number) {
            this._selectedMeshs.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this.coneMeshCollection.forEach((mesh) => {
                mesh.scale.setScalar(value);
            });
            this._scale = value;
        }

        get lookupCriterias(): ISumUpCriteria {
            return this._sumUpProperties;
        }

        public constructor(
            mainProjector: string, scene: THREE.Scene, camera: THREE.Camera, countries: CountryBoard, renderer: THREE.WebGLRenderer) {
            if (!mapProjectors.hasOwnProperty(mainProjector)) {
                mainProjector = Object.keys(mapProjectors)[0];
            }
            this._scene = scene;
            this._camera = camera;
            this._raycaster = new THREE.Raycaster();
            this._projection = mainProjector;
            this._countries = countries;
            this._renderer = renderer;
        }

        public add(lookup: ILookupTownTransport, distance: number): void {
            let myConsistentLookup = <ILookupTownTransport>{};
            // for (let cityCode in lookup) {
            //     if (lookup.hasOwnProperty(cityCode) && Object.keys(lookup[cityCode].transports).length > 1) {
            //         myConsistentLookup[cityCode] = lookup[cityCode];
            //     }
            // }
            // lookup = myConsistentLookup;
            let that = this;
            let bboxes = this._countries.countryMeshCollection.map((country) => (<CountryGeometry>country.geometry).bbox);
            ConeMeshShader.generateCones(lookup, bboxes).then((cones) => {
                cones.forEach((cone) => {
                    updateSumUpCriteria(that._sumUpProperties, cone.otherProperties);
                    that.coneMeshCollection.push(cone);
                    cone.visible = that._show;
                    cone.scale.setScalar(that._scale);
                    that._scene.add(cone);
                    that._renderer.render(that._scene, that._camera);
                });
            });
        }

        public setLayer(transport: string, show: boolean): void {
            this.searchMesh({ transport: { value: transport } }).forEach((mesh) => {
                mesh.visible = show;
            });
        }
        public clean(): void {
            for (let i = this.coneMeshCollection.length - 1; i >= 0; i--) {
                this._scene.remove(this.coneMeshCollection[i]);
                this.coneMeshCollection[i].dispose();
                this.coneMeshCollection.splice(i, 1);
            }
            this._sumUpProperties = {};
        }

        public getMeshByMouse(event: MouseEvent, highLight: boolean = false): PseudoCone {
            let resultat: PseudoCone;
            let mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            this._raycaster.setFromCamera(mouse, this._camera);
            let intersects = this._raycaster.intersectObjects(this.coneMeshCollection);
            if (intersects.length > 0) {
                resultat = <PseudoCone>intersects[0].object;
                this.highLight(resultat.otherProperties, highLight);
            } else {
                this._selectedMeshs.forEach((mesh) => {
                    if (!Array.isArray(mesh.material)) {
                        mesh.material.visible = false;
                    }
                });
            }
            return resultat;
        }

        public setLimits(criterias: ICriterias, limit: boolean): void {
            this.searchMesh(criterias).forEach((country) => {
                country.withLimits = limit;
            });
        }

        public highLight(criterias: ICriterias, light: boolean): void {
            if (criterias !== this._highlitedCriterias) {
                this._highlitedCriterias = criterias;
                let that = this;
                this._selectedMeshs.forEach((mesh) => {
                    that._scene.remove(mesh);
                });
                this._selectedMeshs = this.searchMesh(criterias).map((mesh) => {
                    let geometry = <THREE.BufferGeometry>mesh.geometry.clone();
                    let out = new THREE.Mesh(geometry, Configuration.highLitedMaterial);
                    out.updateMorphTargets();
                    for (let i = 0; i < (<any>mesh).morphTargetInfluences.length; i++) {
                        (<any>out).morphTargetInfluences[i] = (<any>mesh).morphTargetInfluences[i];
                    }
                    that._scene.add(out);
                    out.scale.setScalar(that._scale);
                    return out;
                });
            }
            this._selectedMeshs.forEach((mesh) => {
                if (!Array.isArray(mesh.material)) {
                    mesh.material.visible = light;
                }
            });
        }

        public searchMesh(criterias: ICriterias | Cartographic, path: string = ''): PseudoCone[] {
            let resultat: PseudoCone[];
            if (criterias instanceof Cartographic) {
                resultat = this.coneMeshCollection.filter((cone) => cone.cartographicPosition.distanceApproximee(criterias) < 1e-13);
            } else {
                resultat = searchCriterias(this.coneMeshCollection, criterias, forbiddenAttributes, 'otherProperties.' + path);
            }
            return resultat;
        }

        public showCriterias(criterias: ICriterias, state: boolean): void {
            let realState = state && this._show;
            this.searchMesh(criterias).forEach((cone) => {
                cone.visible = realState;
            });
        }

        private _reHighLight(): void {
            if (this._selectedMeshs.length > 0) {
                let visible = false;
                let temp = this._selectedMeshs[0];
                if (!Array.isArray(temp.material)) {
                    visible = temp.material.visible;
                }
                let criterias = this._highlitedCriterias;
                this._highlitedCriterias = undefined;
                this.highLight(criterias, visible);
            }
        }
    }
}