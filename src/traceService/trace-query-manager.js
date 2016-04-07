import JsLinQ from "jslinq";

export class TraceQueryManager{
	constructor(traceModel){
		this.filters = traceModel.traceSearchfilters;
	}
	
    contains(a,b){
        return (a.toString().indexOf(b) > -1);
    }
    containsIgnoreCase(a,b){
        return (a.toString().toLowerCase().indexOf(b) > -1);
    }

    getQuery(rawData, filterSelection, searchTerm){
        let contains = this.contains, filters = this.filters, dataSet = JsLinQ(rawData), query;
        
        if(searchTerm === ""){
            return dataSet;
        }
        
        switch(filters[filterSelection]){
        	case filters.any:
                query = dataSet.where(function(item){return contains(item.id,searchTerm)||contains(item.type,searchTerm)||
                    contains(item.text,searchTerm)||contains(item.values,searchTerm);    
                    }).ToArray();
        		break;
        	default:
                query = dataSet.where(function(item){
                    return contains(item[filterSelection],searchTerm);
                    }).ToArray();
        		break;  
        }
        return query;
    }
    
}