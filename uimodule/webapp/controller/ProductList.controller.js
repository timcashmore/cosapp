sap.ui.define([
    "sap/base/Log",
    "sap/ui/core/mvc/Controller",
	"sap/ui/model/Sorter",
	"sap/ui/model/json/JSONModel",
    "sap/ui/core/format/DateFormat",
	"sap/m/ToolbarSpacer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/library",
	"sap/ui/thirdparty/jquery",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function(Log, Controller, Sorter, JSONModel, DateFormat, ToolbarSpacer, Filter, FilterOperator, library, jquery, MessageBox, MessageToast) {
    "use strict";
    
	var oSort = library.SortOrder;
	
    return Controller.extend("cosapp.tc.cosapp.controller.ProductList", {

		onInit : function () {
			var oView = this.getView();
			// Register the view with the message manager - validation messages in table ??
			sap.ui.getCore().getMessageManager().registerObject(oView, true);
	
			//Upload and extend the model from API call
			this.initDataModel();
			//Intialise filter/search
			this._oGlobalFilter = null;
        },
		
		resetFiltersAndSorts: function(oEvent) {
			this.clearAllSortings(oEvent);
			//Now reset filters
			this._oGlobalFilter = null;
			this._filter();
		},
	
		clearAllSortings : function(oEvent) {
			var oTable = this.byId("table");
			oTable.getBinding("rows").sort(null);
			this._resetSortingState();
		},
				
		sortCombination : function(oEvent) {
			// Work out which button has been pressed
			var oSortOrder = library.SortOrder;
			if(oEvent.getSource().getId().indexOf("ascending") > 0) { 
				oSortOrder = oSort.Ascending;
			} else {
				oSortOrder = oSort.Descending;
			}
			// Reset Sort
            this.clearAllSortings(oEvent);
            // Now check the order of the columns in the table
            // The user may have dragged/dropped in a different sequence
            var oView = this.getView();
			var oTable = oView.byId("table");
			//Now work out the model for this table
			var oModel = oTable.getBinding("rows").getModel();
//			console.log("oTable =" + oTable);
            var aColumns = oTable.getColumns();
			var oSortAdd = false;
			// Loop around all columns and sort in order
            for (var i = 0; i < aColumns.length; i++) {
				// Column sortProperty has to exist to include in Sorter
                if (aColumns[i].getSortProperty()) {
//					console.log(aColumns[i].getId());
					oTable.sort(oView.byId(aColumns[i].getId()), oSortOrder, oSortAdd);
     	            oSortAdd = true;
                }  
            }
         }, 
        _resetSortingState : function() {
			var oTable = this.byId("table");
			var aColumns = oTable.getColumns();
			for (var i = 0; i < aColumns.length; i++) {
				aColumns[i].setSorted(false);
			}
		},
		
        _filter : function() {
    		var oFilter = null;
            if (this._oGlobalFilter) {
				oFilter = this._oGlobalFilter;
			}
			this.byId("table").getBinding("rows").filter(oFilter, "Application");
		},
		filterGlobally : function(oEvent) {
			var sQuery = oEvent.getParameter("query");
			this._oGlobalFilter = null;
			if (sQuery) {
				this._oGlobalFilter = new Filter([
//					new Filter("updated", FilterOperator.Contains, sQuery),
					new Filter("description", FilterOperator.Contains, sQuery),
					new Filter("catalog", FilterOperator.Contains, sQuery),
					new Filter("productId", FilterOperator.Contains, sQuery),
                    new Filter("source/sourceId", FilterOperator.Contains, sQuery),
				], false);
			}
			this._filter();
		},
		
        clearAllFilters : function(oEvent) {
			var oTable = this.byId("table");
			var oUiModel = this.getView().getModel("ui");
			oUiModel.setProperty("/globalFilter", "");

			this._oGlobalFilter = null;
			this._filter();
			// Clear all filters by Column
			var aColumns = oTable.getColumns();
			for (var i = 0; i < aColumns.length; i++) {
				oTable.filter(aColumns[i], null);
			}
		},
		
		formatAvailableToObjectState : function(bAvailable) {
			return bAvailable ? "Success" : "Error";
		},

		onSavePress: function(oEvent) {
			this.showUpdated(oEvent);
			MessageBox.confirm("Save all updates ?", { onClose: oAction => {
					if (oAction == "OK" ) {
						this.updateValues(oAction); 
					} else {
						MessageToast.show("Update Cancelled");
					}	
				} 
			});
		},

		updateValues: function(oAction) {
			var oModel = this.getView().getModel("product");
			// Identify updated items and prepare to send update back to COS in correct POST format
			var filterValues = oModel.oData.items.filter( item => item.updated == "U" );
			//Need to make a deep copy as updates remove original properties
			//var updatedInventoryValues = $.extend( true, {}, filter );
			var updatedInventoryValues = JSON.parse(JSON.stringify(filterValues));
			updatedInventoryValues.forEach( item => {
				delete item.description;
				delete item.catalog;
				delete item.updated;
				item.items[0].quantity = item.items[0].iQuantity
				delete item.items[0].iQuantity;
				delete item.items[0].oldQuantity;
			} );
			console.log("items= " + oModel.oData.items.length);
//			console.log(new Date().toISOString());
			console.log("updated= " + updatedInventoryValues.length);
			//Post the data and wait
			this._postInventory(JSON.stringify(updatedInventoryValues));
		},

		_postInventory: function (updatedInventoryJSON) {
			console.log("in Post Inventory" + updatedInventoryJSON);
			// Need to get xrsf token first
			$.ajax({
				url: '/availabilityRawData',
				type: 'GET',
				dataType: 'json',
				async: false,
				contentType: 'application/json',
				beforeSend: function(xhr) {
					xhr.setRequestHeader('X-CSRF-Token', 'fetch');
				},
				complete: function(response) {
					console.log("Iin token get "+ response);
					jQuery.ajaxSetup({
						beforeSend: function(xhr) {
						  xhr.setRequestHeader("X-CSRF-Token",response.getResponseHeader('X-CSRF-Token'));
						}
					  });
				},
				error: function(error) {
					console.log("Error on Token Fetch: "+ error);
				}
			  });
			
			var success = false;
			$.ajax({
				url: '/availabilityRawData',
				type: 'POST',
				data: updatedInventoryJSON,
//				dataType: 'json',
				async: false,
//				data: $.param(updatedInventoryJSON),
//				contentType: 'application/x-www-form-urlencoded',
				contentType: 'application/json',
				success: function(data) {
					console.log("InventoryData Updated: "+ data);
					MessageToast.show(`Update Completed`);
					success = true;
				},
				error: function(e) {
					console.log("Error on Inventory Update: "+ e);
					MessageToast.show(`Update Failed`);
				}
			  });
			  // Need to call function outside of Ajax call to refresh data
			  if (success) { this.initDataModel(); }
		},

		showUpdated: function(oEvent) {	
			//Keep sort but reest filter to select only the updated items
			this._oGlobalFilter = null;
			this._oGlobalFilter = new Filter([
					new Filter("updated", FilterOperator.Contains, "U")
				], false);
			this._filter();
		},

		inputChange : function(oEvent) {
				//Get the object associated with the row in the table (abstract class sap.ui.model.Context)
				var oContext = oEvent.getSource().getBindingContext("product");
				var newVal = parseInt(oEvent.getParameter("value"),10);
				var oldVal = oContext.getProperty("items/0/quantity");   //Make sure non valid number isnt updated
				//Flag the item as updated if old quantity not equal to new quantity (or reset if equal)
				var oProductModel=oContext.getModel("product");
				if (newVal !== oldVal && !isNaN(newVal)) {    //Careful of type checking !
					oProductModel.setProperty(oContext.getPath("items/0/oldQuantity"), oldVal);
					oProductModel.setProperty(oContext.getPath("updated"), "U");
				} else {
					oProductModel.setProperty(oContext.getPath("updated"), "");
					oProductModel.setProperty(oContext.getPath("items/0/oldQuantity"), "");
				}
		},


		initDataModel : function() {
			console.log("in initDataModel");
			var oProductModel = new JSONModel();
			// Set promise to update the data
//			var oPromise = oProductModel.loadData("./TestData/Products.json");
			var oPromise = oProductModel.loadData("/api/inventory");
//			var oPromise = oProductModel.loadData("/availabilityRawData");
//			oProductModel.loadData("./TestData/Products.json");
//			$.ajax()
/*			jQuery.ajax("/api/Inventory", {
				dataType: "json",
				method: "GET",
				success: function(oData) {
					console.log("availabilityRawData=" + oData);
				},
				error: function() {
					console.Log.error("failed to load json availability raw data");
				}
			}); */
			//Promise: Only required if want to make some updates to the data
			oPromise.then( () => {
				//Now add in an additional field as the input
				var oLen = oProductModel.getData().items.length;
//				var testFlag = 0;
				for (var i = 0; i < oLen; i++) { 
					var oPath = "/items/" + i + "/items/0/";
					var oExistQuantity = oProductModel.getProperty(oPath + "quantity");
//					console.log(`path=${oPath}`)
					oProductModel.setProperty(oPath + "iQuantity", oExistQuantity);
					oProductModel.setProperty(`/items/${i}/items/0/oldQuantity`, "");
					oProductModel.setProperty(`/items/${i}/updated`, "");
//					 i % 2 > 0 ? testFlag = 0 : testFlag = 1;
				}; 
			}); 
			//Set the data models to be used by the views
			var oUiModel = new JSONModel({
				globalFilter: "",
				visibleRowCount: 20,
				changedClass: ".myCustomText",
			});
			this.getView().setModel(oUiModel,"ui"); 
			this.getView().setModel(oProductModel,"product");

		}
	});
});