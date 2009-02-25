var T ={};
T.getMembers = function(obj) 
{ 
	var s=[]; 

	for (i in obj) 
	{
		s.push(i+" (" + typeof obj[i] + ")\r\n"); 
	} 

	return s.join(" "); 
}
