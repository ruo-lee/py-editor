/**
 * modelRefCounter.js - Monaco Model Reference Counter
 * Tracks model usage across multiple editors to prevent premature disposal
 */

class ModelRefCounter {
    constructor() {
        // Map<modelUri, { model, refCount, listeners }>
        this.models = new Map();
    }

    /**
     * Add a reference to a model
     * @param {monaco.editor.ITextModel} model - Monaco editor model
     * @param {string} filepath - File path
     * @returns {object} Model info with ref count
     */
    addReference(model, filepath) {
        const uri = model.uri.toString();

        if (this.models.has(uri)) {
            // Increment reference count
            const modelInfo = this.models.get(uri);
            modelInfo.refCount++;
            console.debug('Incremented model reference', {
                filepath,
                uri,
                refCount: modelInfo.refCount,
            });
            return modelInfo;
        }

        // Create new reference entry
        const modelInfo = {
            model,
            filepath,
            refCount: 1,
            listeners: [], // Store disposable listeners
        };

        this.models.set(uri, modelInfo);
        console.debug('Created model reference', { filepath, uri, refCount: 1 });

        return modelInfo;
    }

    /**
     * Remove a reference from a model
     * @param {string} modelUri - Model URI
     * @returns {boolean} True if model was disposed
     */
    removeReference(modelUri) {
        if (!this.models.has(modelUri)) {
            console.warn('Attempted to remove reference for non-existent model', { modelUri });
            return false;
        }

        const modelInfo = this.models.get(modelUri);
        modelInfo.refCount--;

        console.debug('Decremented model reference', {
            filepath: modelInfo.filepath,
            uri: modelUri,
            refCount: modelInfo.refCount,
        });

        // Dispose model only when no more references
        if (modelInfo.refCount <= 0) {
            // Cleanup all listeners
            if (modelInfo.listeners) {
                modelInfo.listeners.forEach((listener) => {
                    if (listener && typeof listener.dispose === 'function') {
                        listener.dispose();
                    }
                });
            }

            // Dispose the model
            if (modelInfo.model && !modelInfo.model.isDisposed()) {
                modelInfo.model.dispose();
                console.debug('Disposed model', {
                    filepath: modelInfo.filepath,
                    uri: modelUri,
                });
            }

            this.models.delete(modelUri);
            return true;
        }

        return false;
    }

    /**
     * Get reference count for a model
     * @param {string} modelUri - Model URI
     * @returns {number} Reference count
     */
    getRefCount(modelUri) {
        const modelInfo = this.models.get(modelUri);
        return modelInfo ? modelInfo.refCount : 0;
    }

    /**
     * Check if a model exists
     * @param {string} modelUri - Model URI
     * @returns {boolean}
     */
    hasModel(modelUri) {
        return this.models.has(modelUri);
    }

    /**
     * Get model info
     * @param {string} modelUri - Model URI
     * @returns {object|null}
     */
    getModelInfo(modelUri) {
        return this.models.get(modelUri) || null;
    }

    /**
     * Add a listener to a model's listener list for cleanup
     * @param {string} modelUri - Model URI
     * @param {IDisposable} listener - Disposable listener
     */
    addListener(modelUri, listener) {
        const modelInfo = this.models.get(modelUri);
        if (modelInfo) {
            modelInfo.listeners.push(listener);
        }
    }

    /**
     * Get all models
     * @returns {Map}
     */
    getAllModels() {
        return this.models;
    }

    /**
     * Get statistics
     * @returns {object}
     */
    getStats() {
        const stats = {
            totalModels: this.models.size,
            totalReferences: 0,
            modelsByRefCount: {},
        };

        for (const [_uri, info] of this.models.entries()) {
            stats.totalReferences += info.refCount;

            if (!stats.modelsByRefCount[info.refCount]) {
                stats.modelsByRefCount[info.refCount] = 0;
            }
            stats.modelsByRefCount[info.refCount]++;
        }

        return stats;
    }

    /**
     * Clear all models (emergency cleanup)
     */
    disposeAll() {
        console.warn('Disposing all models', { count: this.models.size });

        for (const [uri, modelInfo] of this.models.entries()) {
            // Cleanup all listeners
            if (modelInfo.listeners) {
                modelInfo.listeners.forEach((listener) => {
                    if (listener && typeof listener.dispose === 'function') {
                        listener.dispose();
                    }
                });
            }

            // Dispose model
            if (modelInfo.model && !modelInfo.model.isDisposed()) {
                modelInfo.model.dispose();
            }
        }

        this.models.clear();
    }
}

// Singleton instance
let refCounterInstance = null;

export function getModelRefCounter() {
    if (!refCounterInstance) {
        refCounterInstance = new ModelRefCounter();
    }
    return refCounterInstance;
}

export { ModelRefCounter };
